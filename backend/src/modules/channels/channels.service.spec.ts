import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ChannelConnectionStatus,
  ChannelType,
  IntegrationEnvironment,
  StoreRole,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { channelConnectionSelect } from './channel.constants';
import { ChannelsService } from './channels.service';
import { CredentialsEncryptionService } from './credentials-encryption.service';
import { ProviderRegistryService } from './providers/provider-registry.service';
import type { ProductSyncDispatcher } from '../product-sync/product-sync.types';

describe('ChannelsService', () => {
  const findStoreMembership = jest.fn();
  const findConnections = jest.fn();
  const findConnectionByProvider = jest.fn();
  const findConnection = jest.fn();
  const createConnection = jest.fn();
  const updateConnection = jest.fn();
  const deleteConnection = jest.fn();
  const getManifest = jest.fn();
  const validateCredentials = jest.fn();
  const verifyCredentials = jest.fn();
  const encryptCredentials = jest.fn();
  const enqueueProductSync = jest.fn();
  const prisma = {
    storeMember: { findUnique: findStoreMembership },
    channelConnection: {
      findMany: findConnections,
      findUnique: findConnectionByProvider,
      findFirst: findConnection,
      create: createConnection,
      update: updateConnection,
      delete: deleteConnection,
    },
  } as unknown as PrismaService;
  const providers = {
    getAvailableProviders: jest.fn(),
    getManifest,
    validateCredentials,
    verifyCredentials,
  } as unknown as ProviderRegistryService;
  const encryption = {
    encrypt: encryptCredentials,
    decrypt: jest.fn(),
  } as unknown as CredentialsEncryptionService;
  const productSyncQueue = {
    enqueue: enqueueProductSync,
  } as ProductSyncDispatcher;
  const service = new ChannelsService(
    prisma,
    providers,
    encryption,
    productSyncQueue,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lists connections only after verifying store membership', async () => {
    findStoreMembership.mockResolvedValue({ role: StoreRole.VIEWER });
    findConnections.mockResolvedValue([]);

    await service.findAll('store-1', 'user-1');

    expect(findConnections).toHaveBeenCalledWith({
      where: { storeId: 'store-1' },
      orderBy: { createdAt: 'asc' },
      select: channelConnectionSelect,
    });
  });

  it('hides stores from users without membership', async () => {
    findStoreMembership.mockResolvedValue(null);

    await expect(service.findAll('store-1', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findConnections).not.toHaveBeenCalled();
  });

  it('does not let viewers create channel connections', async () => {
    findStoreMembership.mockResolvedValue({ role: StoreRole.VIEWER });

    await expect(
      service.create('store-1', 'user-1', {
        providerKey: 'trendyol',
        environment: IntegrationEnvironment.SANDBOX,
        credentials: { supplierId: '123', apiKey: 'key', apiSecret: 'secret' },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(createConnection).not.toHaveBeenCalled();
  });

  it('verifies, encrypts and creates a connected provider', async () => {
    const now = new Date('2026-08-30T10:00:00.000Z');
    const credentials = {
      supplierId: '123',
      apiKey: 'key',
      apiSecret: 'secret',
    };
    findStoreMembership.mockResolvedValue({ role: StoreRole.ADMIN });
    findConnectionByProvider.mockResolvedValue(null);
    createConnection.mockResolvedValue({ id: 'connection-1' });
    getManifest.mockReturnValue({
      key: 'trendyol',
      name: 'Trendyol',
      type: 'COMMERCE',
      image: '/merchants/trendyol.webp',
      description: 'Trendyol',
      environments: ['SANDBOX', 'PRODUCTION'],
      credentialFields: [],
    });
    validateCredentials.mockReturnValue(credentials);
    verifyCredentials.mockResolvedValue(undefined);
    encryptCredentials.mockReturnValue('encrypted');
    jest.useFakeTimers({ now });

    await service.create('store-1', 'user-1', {
      providerKey: 'trendyol',
      environment: IntegrationEnvironment.SANDBOX,
      credentials,
    });

    expect(verifyCredentials).toHaveBeenCalledWith('trendyol', {
      environment: IntegrationEnvironment.SANDBOX,
      credentials,
    });
    expect(createConnection).toHaveBeenCalledWith({
      data: {
        storeId: 'store-1',
        providerKey: 'trendyol',
        type: ChannelType.COMMERCE,
        environment: IntegrationEnvironment.SANDBOX,
        credentialsEncrypted: 'encrypted',
        status: ChannelConnectionStatus.CONNECTED,
        connectedAt: now,
      },
      select: channelConnectionSelect,
    });
  });

  it('disconnects only a connection belonging to the requested store', async () => {
    findStoreMembership.mockResolvedValue({ role: StoreRole.OWNER });
    findConnection.mockResolvedValue({ id: 'connection-1' });
    updateConnection.mockResolvedValue({ id: 'connection-1' });

    await service.disconnect('store-1', 'connection-1', 'user-1');

    expect(findConnection).toHaveBeenCalledWith({
      where: { id: 'connection-1', storeId: 'store-1' },
      select: { id: true },
    });
    expect(updateConnection).toHaveBeenCalledWith({
      where: { id: 'connection-1' },
      data: { status: ChannelConnectionStatus.DISCONNECTED },
      select: channelConnectionSelect,
    });
  });

  it('queues catalog sync instead of processing products in the request', async () => {
    const queuedAt = new Date('2026-08-30T10:00:00.000Z');
    findStoreMembership.mockResolvedValue({ role: StoreRole.OWNER });
    findConnection.mockResolvedValue({
      id: 'connection-1',
      providerKey: 'trendyol',
      environment: IntegrationEnvironment.SANDBOX,
      status: ChannelConnectionStatus.CONNECTED,
      credentialsEncrypted: 'encrypted',
    });
    enqueueProductSync.mockResolvedValue({
      syncRunId: 'sync-run-1',
      status: 'RUNNING',
      queuedAt,
      kind: 'FULL',
    });

    const result = await service.syncCatalog(
      'store-1',
      'connection-1',
      'user-1',
    );

    expect(enqueueProductSync).toHaveBeenCalledWith(
      'store-1',
      'connection-1',
      'FULL',
    );
    expect(result).toEqual({
      syncRunId: 'sync-run-1',
      status: 'RUNNING',
      queuedAt,
      kind: 'FULL',
    });
  });

  it('queues a lightweight inventory sync for connected providers', async () => {
    const queuedAt = new Date('2026-08-30T10:00:00.000Z');
    findStoreMembership.mockResolvedValue({ role: StoreRole.OWNER });
    findConnection.mockResolvedValue({
      id: 'connection-1',
      providerKey: 'trendyol',
      environment: IntegrationEnvironment.SANDBOX,
      status: ChannelConnectionStatus.CONNECTED,
      credentialsEncrypted: 'encrypted',
    });
    enqueueProductSync.mockResolvedValue({
      syncRunId: 'sync-run-2',
      status: 'RUNNING',
      queuedAt,
      kind: 'INVENTORY',
    });

    const result = await service.syncInventory(
      'store-1',
      'connection-1',
      'user-1',
    );

    expect(enqueueProductSync).toHaveBeenCalledWith(
      'store-1',
      'connection-1',
      'INVENTORY',
    );
    expect(result.kind).toBe('INVENTORY');
  });

  it('does not remove a connection from another store', async () => {
    findStoreMembership.mockResolvedValue({ role: StoreRole.OWNER });
    findConnection.mockResolvedValue(null);

    await expect(
      service.remove('store-1', 'connection-2', 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(deleteConnection).not.toHaveBeenCalled();
  });
});
