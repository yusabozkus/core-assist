import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ChannelConnectionStatus,
  ChannelProvider,
  ChannelType,
  StoreRole,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { channelConnectionSelect } from './channel.constants';
import { ChannelsService } from './channels.service';

describe('ChannelsService', () => {
  const findStoreMembership = jest.fn();
  const findConnections = jest.fn();
  const findConnectionByProvider = jest.fn();
  const findConnection = jest.fn();
  const createConnection = jest.fn();
  const updateConnection = jest.fn();
  const deleteConnection = jest.fn();
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
  const service = new ChannelsService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
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
        provider: ChannelProvider.TRENDYOL,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(createConnection).not.toHaveBeenCalled();
  });

  it('creates a pending connection with the provider channel type', async () => {
    findStoreMembership.mockResolvedValue({ role: StoreRole.ADMIN });
    findConnectionByProvider.mockResolvedValue(null);
    createConnection.mockResolvedValue({ id: 'connection-1' });

    await service.create('store-1', 'user-1', {
      provider: ChannelProvider.WHATSAPP,
    });

    expect(createConnection).toHaveBeenCalledWith({
      data: {
        storeId: 'store-1',
        provider: ChannelProvider.WHATSAPP,
        type: ChannelType.MESSAGING,
        status: ChannelConnectionStatus.PENDING,
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

  it('does not remove a connection from another store', async () => {
    findStoreMembership.mockResolvedValue({ role: StoreRole.OWNER });
    findConnection.mockResolvedValue(null);

    await expect(
      service.remove('store-1', 'connection-2', 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(deleteConnection).not.toHaveBeenCalled();
  });
});
