import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CatalogSyncStatus,
  ChannelConnectionStatus,
  StoreRole,
  StoreStatus,
} from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PRODUCT_SYNC_DISPATCHER } from '../product-sync/product-sync.constants';
import type { ProductSyncDispatcher } from '../product-sync/product-sync.types';
import { channelConnectionSelect } from './channel.constants';
import { CredentialsEncryptionService } from './credentials-encryption.service';
import { ConfigureChannelConnectionDto } from './dto/configure-channel-connection.dto';
import { CreateChannelConnectionDto } from './dto/create-channel-connection.dto';
import {
  type SyncHistoryQueryDto,
  SyncHistoryKindFilter,
  SyncHistoryStatusFilter,
} from './dto/sync-history-query.dto';
import { ProviderRegistryService } from './providers/provider-registry.service';

@Injectable()
export class ChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderRegistryService,
    private readonly encryption: CredentialsEncryptionService,
    @Inject(PRODUCT_SYNC_DISPATCHER)
    private readonly productSyncQueue: ProductSyncDispatcher,
  ) {}

  async findAvailableProviders(storeId: string, userId: string) {
    await this.requireStoreMembership(storeId, userId);
    return this.providers.getAvailableProviders();
  }

  async findAll(storeId: string, userId: string) {
    await this.requireStoreMembership(storeId, userId);

    return this.prisma.channelConnection.findMany({
      where: { storeId },
      orderBy: { createdAt: 'asc' },
      select: channelConnectionSelect,
    });
  }

  async findSyncHistory(
    storeId: string,
    userId: string,
    query: SyncHistoryQueryDto,
  ) {
    await this.requireStoreMembership(storeId, userId);

    const provider = query.provider?.trim();
    const where = {
      connection: {
        storeId,
        ...(provider ? { providerKey: provider } : {}),
      },
      ...(query.status !== SyncHistoryStatusFilter.ALL
        ? { status: query.status }
        : {}),
      ...(query.kind !== SyncHistoryKindFilter.ALL ? { kind: query.kind } : {}),
    } satisfies Prisma.CatalogSyncRunWhereInput;
    const storeWhere = {
      connection: { storeId },
    } satisfies Prisma.CatalogSyncRunWhereInput;

    const [runs, filteredTotal, statusGroups, providerConnections] =
      await Promise.all([
        this.prisma.catalogSyncRun.findMany({
          where,
          orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
          take: query.limit + 1,
          ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
          select: {
            id: true,
            kind: true,
            status: true,
            productsProcessed: true,
            variantsProcessed: true,
            questionsProcessed: true,
            productsArchived: true,
            errorMessage: true,
            startedAt: true,
            completedAt: true,
            connection: {
              select: {
                id: true,
                providerKey: true,
                environment: true,
              },
            },
          },
        }),
        this.prisma.catalogSyncRun.count({ where }),
        this.prisma.catalogSyncRun.groupBy({
          by: ['status'],
          where: storeWhere,
          _count: { _all: true },
        }),
        this.prisma.channelConnection.findMany({
          where: { storeId, syncRuns: { some: {} } },
          distinct: ['providerKey'],
          orderBy: { providerKey: 'asc' },
          select: { providerKey: true },
        }),
      ]);

    const hasNextPage = runs.length > query.limit;
    const items = hasNextPage ? runs.slice(0, query.limit) : runs;
    const statusCount = (status: CatalogSyncStatus) =>
      statusGroups.find((group) => group.status === status)?._count._all ?? 0;

    return {
      items: items.map((run) => ({
        id: run.id,
        kind: run.kind,
        status: run.status,
        productsProcessed: run.productsProcessed,
        variantsProcessed: run.variantsProcessed,
        questionsProcessed: run.questionsProcessed,
        productsArchived: run.productsArchived,
        errorMessage: run.errorMessage,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        connectionId: run.connection.id,
        providerKey: run.connection.providerKey,
        environment: run.connection.environment,
      })),
      nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
      total: filteredTotal,
      providers: providerConnections.map(
        (connection) => connection.providerKey,
      ),
      summary: {
        total: statusGroups.reduce(
          (total, group) => total + group._count._all,
          0,
        ),
        running: statusCount(CatalogSyncStatus.RUNNING),
        completed: statusCount(CatalogSyncStatus.COMPLETED),
        failed: statusCount(CatalogSyncStatus.FAILED),
      },
    };
  }

  async create(
    storeId: string,
    userId: string,
    dto: CreateChannelConnectionDto,
  ) {
    await this.requireStoreManagement(storeId, userId);
    const manifest = this.providers.getManifest(dto.providerKey);
    const credentials = this.providers.validateCredentials(
      dto.providerKey,
      dto.environment,
      dto.credentials,
    );
    const existingConnection = await this.prisma.channelConnection.findUnique({
      where: {
        storeId_providerKey: {
          storeId,
          providerKey: dto.providerKey,
        },
      },
      select: { id: true },
    });

    if (existingConnection) {
      throw new ConflictException('Bu satış kanalı mağazaya zaten eklenmiş.');
    }

    await this.providers.verifyCredentials(dto.providerKey, {
      environment: dto.environment,
      credentials,
    });

    return this.prisma.channelConnection.create({
      data: {
        storeId,
        providerKey: dto.providerKey,
        type: manifest.type,
        environment: dto.environment,
        credentialsEncrypted: this.encryption.encrypt(credentials),
        status: ChannelConnectionStatus.CONNECTED,
        connectedAt: new Date(),
      },
      select: channelConnectionSelect,
    });
  }

  async configure(
    storeId: string,
    connectionId: string,
    userId: string,
    dto: ConfigureChannelConnectionDto,
  ) {
    await this.requireStoreManagement(storeId, userId);
    const connection = await this.getConnection(storeId, connectionId);
    const credentials = this.providers.validateCredentials(
      connection.providerKey,
      dto.environment,
      dto.credentials,
    );

    await this.providers.verifyCredentials(connection.providerKey, {
      environment: dto.environment,
      credentials,
    });

    return this.prisma.channelConnection.update({
      where: { id: connection.id },
      data: {
        environment: dto.environment,
        credentialsEncrypted: this.encryption.encrypt(credentials),
        credentialSchemaVersion: 1,
        status: ChannelConnectionStatus.CONNECTED,
        connectedAt: new Date(),
        failureReason: null,
      },
      select: channelConnectionSelect,
    });
  }

  async disconnect(storeId: string, connectionId: string, userId: string) {
    await this.requireStoreManagement(storeId, userId);
    await this.requireConnection(storeId, connectionId);

    return this.prisma.channelConnection.update({
      where: { id: connectionId },
      data: { status: ChannelConnectionStatus.DISCONNECTED },
      select: channelConnectionSelect,
    });
  }

  async reconnect(storeId: string, connectionId: string, userId: string) {
    await this.requireStoreManagement(storeId, userId);
    const connection = await this.getConnection(storeId, connectionId);

    if (!connection.credentialsEncrypted) {
      throw new BadRequestException(
        'Bağlantı bilgileri eksik. Kanalı yeniden yapılandırın.',
      );
    }

    const credentials = this.encryption.decrypt(
      connection.credentialsEncrypted,
    );
    await this.providers.verifyCredentials(connection.providerKey, {
      environment: connection.environment,
      credentials,
    });

    return this.prisma.channelConnection.update({
      where: { id: connectionId },
      data: {
        status: ChannelConnectionStatus.CONNECTED,
        connectedAt: new Date(),
        failureReason: null,
      },
      select: channelConnectionSelect,
    });
  }

  async syncCatalog(storeId: string, connectionId: string, userId: string) {
    return this.queueSync(storeId, connectionId, userId, 'FULL');
  }

  async syncInventory(storeId: string, connectionId: string, userId: string) {
    return this.queueSync(storeId, connectionId, userId, 'INVENTORY');
  }

  private async queueSync(
    storeId: string,
    connectionId: string,
    userId: string,
    kind: 'FULL' | 'INVENTORY',
  ) {
    await this.requireStoreManagement(storeId, userId);
    const connection = await this.getConnection(storeId, connectionId);

    if (
      connection.status !== ChannelConnectionStatus.CONNECTED ||
      !connection.credentialsEncrypted
    ) {
      throw new BadRequestException(
        'Ürünleri senkronize etmeden önce kanal bağlantısını tamamlayın.',
      );
    }

    return this.productSyncQueue.enqueue(storeId, connectionId, kind);
  }

  async remove(storeId: string, connectionId: string, userId: string) {
    await this.requireStoreManagement(storeId, userId);
    await this.requireConnection(storeId, connectionId);

    await this.prisma.channelConnection.delete({
      where: { id: connectionId },
    });

    return { deleted: true };
  }

  private async requireStoreMembership(storeId: string, userId: string) {
    const membership = await this.prisma.storeMember.findFirst({
      where: {
        storeId,
        userId,
        store: { status: StoreStatus.ACTIVE },
      },
      select: { role: true },
    });

    if (!membership) {
      throw new NotFoundException(
        'Mağaza bulunamadı, arşivlenmiş veya erişiminiz yok.',
      );
    }

    return membership;
  }

  private async requireStoreManagement(storeId: string, userId: string) {
    const membership = await this.requireStoreMembership(storeId, userId);

    if (
      membership.role !== StoreRole.OWNER &&
      membership.role !== StoreRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Satış kanallarını yönetme yetkiniz bulunmuyor.',
      );
    }
  }

  private async requireConnection(storeId: string, connectionId: string) {
    const connection = await this.prisma.channelConnection.findFirst({
      where: { id: connectionId, storeId },
      select: { id: true },
    });

    if (!connection) {
      throw new NotFoundException('Satış kanalı bağlantısı bulunamadı.');
    }
  }

  private async getConnection(storeId: string, connectionId: string) {
    const connection = await this.prisma.channelConnection.findFirst({
      where: { id: connectionId, storeId },
      select: {
        id: true,
        providerKey: true,
        environment: true,
        status: true,
        credentialsEncrypted: true,
      },
    });

    if (!connection) {
      throw new NotFoundException('Satış kanalı bağlantısı bulunamadı.');
    }

    return connection;
  }
}
