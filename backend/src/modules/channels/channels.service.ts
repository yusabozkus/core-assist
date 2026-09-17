import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CatalogSyncStage,
  CatalogSyncStatus,
  ChannelConnectionStatus,
  InventoryPolicy,
  ProductQuestionStatus,
  QuestionAnswerStatus,
  StoreRole,
  StoreStatus,
} from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PRODUCT_SYNC_DISPATCHER } from '../product-sync/product-sync.constants';
import type { ProductSyncDispatcher } from '../product-sync/product-sync.types';
import { recalculateStoreVariantInventory } from '../product-sync/inventory-policy';
import { QUESTION_SYNC_DISPATCHER } from '../question-sync/question-sync.constants';
import type { QuestionSyncDispatcher } from '../question-sync/question-sync.types';
import { NotificationsService } from '../notifications/notifications.service';
import { channelConnectionSelect } from './channel.constants';
import { CredentialsEncryptionService } from './credentials-encryption.service';
import { ConfigureChannelConnectionDto } from './dto/configure-channel-connection.dto';
import { CreateChannelConnectionDto } from './dto/create-channel-connection.dto';
import {
  type SyncHistoryQueryDto,
  SyncHistoryKindFilter,
  SyncHistoryOrder,
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
    @Inject(QUESTION_SYNC_DISPATCHER)
    private readonly questionSyncQueue: QuestionSyncDispatcher,
    private readonly notifications: NotificationsService,
  ) {}

  async findAvailableProviders(storeId: string, userId: string) {
    await this.requireStoreMembership(storeId, userId);
    return this.providers.getAvailableProviders();
  }

  async findAll(storeId: string, userId: string) {
    await this.requireStoreMembership(storeId, userId);

    return this.prisma.channelConnection.findMany({
      where: { storeId, removedAt: null },
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
    const scopeWhere = {
      connection: {
        storeId,
        ...(provider ? { providerKey: provider } : {}),
      },
      ...(query.kind !== SyncHistoryKindFilter.ALL ? { kind: query.kind } : {}),
      ...(query.from ? { startedAt: { gte: new Date(query.from) } } : {}),
    } satisfies Prisma.CatalogSyncRunWhereInput;
    const where = {
      ...scopeWhere,
      ...(query.status !== SyncHistoryStatusFilter.ALL
        ? { status: query.status }
        : {}),
    } satisfies Prisma.CatalogSyncRunWhereInput;
    const direction = query.order === SyncHistoryOrder.OLDEST ? 'asc' : 'desc';

    const [
      runs,
      filteredTotal,
      statusGroups,
      providerConnections,
      lastSuccessfulRun,
    ] = await Promise.all([
      this.prisma.catalogSyncRun.findMany({
        where,
        orderBy: [{ startedAt: direction }, { id: direction }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          kind: true,
          status: true,
          trigger: true,
          stage: true,
          progress: true,
          retryOfId: true,
          productsProcessed: true,
          variantsProcessed: true,
          questionsProcessed: true,
          productsArchived: true,
          productsCreated: true,
          productsUpdated: true,
          productsUnchanged: true,
          productsSkipped: true,
          variantsUpdated: true,
          variantsUnchanged: true,
          questionsUnchanged: true,
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
        where: scopeWhere,
        _count: { _all: true },
      }),
      this.prisma.channelConnection.findMany({
        where: { storeId, syncRuns: { some: {} } },
        orderBy: { providerKey: 'asc' },
        select: {
          providerKey: true,
          status: true,
          failureReason: true,
          questionSyncFailureReason: true,
          syncRuns: {
            take: 1,
            orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
            select: {
              id: true,
              kind: true,
              status: true,
              startedAt: true,
              completedAt: true,
            },
          },
        },
      }),
      this.prisma.catalogSyncRun.findFirst({
        where: { ...scopeWhere, status: CatalogSyncStatus.COMPLETED },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
      }),
    ]);

    const hasNextPage = runs.length > query.limit;
    const items = hasNextPage ? runs.slice(0, query.limit) : runs;
    const statusCount = (status: CatalogSyncStatus) =>
      statusGroups.find((group) => group.status === status)?._count._all ?? 0;
    const completed = statusCount(CatalogSyncStatus.COMPLETED);
    const failed = statusCount(CatalogSyncStatus.FAILED);
    const finished = completed + failed;

    return {
      items: items.map((run) => ({
        id: run.id,
        kind: run.kind,
        status: run.status,
        trigger: run.trigger,
        stage: normalizeSyncStage(run.status, run.stage),
        progress: normalizeSyncProgress(run.status, run.progress),
        retryOfId: run.retryOfId,
        productsProcessed: run.productsProcessed,
        variantsProcessed: run.variantsProcessed,
        questionsProcessed: run.questionsProcessed,
        productsArchived: run.productsArchived,
        productsCreated: run.productsCreated,
        productsUpdated: run.productsUpdated,
        productsUnchanged: run.productsUnchanged,
        productsSkipped: run.productsSkipped,
        variantsUpdated: run.variantsUpdated,
        variantsUnchanged: run.variantsUnchanged,
        questionsUnchanged: run.questionsUnchanged,
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
      providerHealth: providerConnections.map((connection) => ({
        providerKey: connection.providerKey,
        connectionStatus: connection.status,
        failureReason:
          connection.failureReason ?? connection.questionSyncFailureReason,
        lastRun: connection.syncRuns[0] ?? null,
      })),
      summary: {
        total: statusGroups.reduce(
          (total, group) => total + group._count._all,
          0,
        ),
        running: statusCount(CatalogSyncStatus.RUNNING),
        completed,
        failed,
        successRate:
          finished === 0 ? null : Math.round((completed / finished) * 100),
        lastSuccessfulAt: lastSuccessfulRun?.completedAt ?? null,
      },
    };
  }

  async findSyncRun(storeId: string, syncRunId: string, userId: string) {
    await this.requireStoreMembership(storeId, userId);

    const run = await this.prisma.catalogSyncRun.findFirst({
      where: { id: syncRunId, connection: { storeId } },
      select: {
        id: true,
        kind: true,
        status: true,
        trigger: true,
        stage: true,
        progress: true,
        retryOfId: true,
        productsProcessed: true,
        variantsProcessed: true,
        questionsProcessed: true,
        productsArchived: true,
        productsCreated: true,
        productsUpdated: true,
        productsUnchanged: true,
        productsSkipped: true,
        variantsUpdated: true,
        variantsUnchanged: true,
        questionsUnchanged: true,
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
    });

    if (!run) {
      throw new NotFoundException('Senkronizasyon işlemi bulunamadı.');
    }

    return {
      id: run.id,
      kind: run.kind,
      status: run.status,
      trigger: run.trigger,
      stage: normalizeSyncStage(run.status, run.stage),
      progress: normalizeSyncProgress(run.status, run.progress),
      retryOfId: run.retryOfId,
      productsProcessed: run.productsProcessed,
      variantsProcessed: run.variantsProcessed,
      questionsProcessed: run.questionsProcessed,
      productsArchived: run.productsArchived,
      productsCreated: run.productsCreated,
      productsUpdated: run.productsUpdated,
      productsUnchanged: run.productsUnchanged,
      productsSkipped: run.productsSkipped,
      variantsUpdated: run.variantsUpdated,
      variantsUnchanged: run.variantsUnchanged,
      questionsUnchanged: run.questionsUnchanged,
      errorMessage: run.errorMessage,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      connectionId: run.connection.id,
      providerKey: run.connection.providerKey,
      environment: run.connection.environment,
    };
  }

  async retrySyncRun(storeId: string, syncRunId: string, userId: string) {
    await this.requireStoreManagement(storeId, userId);

    return this.retrySyncRunRecord(syncRunId, storeId);
  }

  async retrySyncRunAsAdmin(syncRunId: string) {
    return this.retrySyncRunRecord(syncRunId);
  }

  private async retrySyncRunRecord(syncRunId: string, storeId?: string) {
    const run = await this.prisma.catalogSyncRun.findFirst({
      where: {
        id: syncRunId,
        ...(storeId ? { connection: { storeId } } : {}),
      },
      select: {
        id: true,
        kind: true,
        status: true,
        connection: {
          select: {
            id: true,
            storeId: true,
            status: true,
            credentialsEncrypted: true,
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Senkronizasyon işlemi bulunamadı.');
    }

    if (run.status !== CatalogSyncStatus.FAILED) {
      throw new ConflictException(
        'Yalnızca başarısız senkronizasyonlar yeniden denenebilir.',
      );
    }

    if (!run.connection.credentialsEncrypted) {
      throw new BadRequestException(
        'Yeniden denemeden önce kanal bağlantı bilgilerini tamamlayın.',
      );
    }

    if (run.connection.status === ChannelConnectionStatus.DISCONNECTED) {
      throw new BadRequestException(
        'Yeniden denemeden önce kanal bağlantısını yeniden bağlayın.',
      );
    }

    if (run.connection.status === ChannelConnectionStatus.ERROR) {
      await this.prisma.channelConnection.update({
        where: { id: run.connection.id },
        data: {
          status: ChannelConnectionStatus.CONNECTED,
          failureReason: null,
        },
      });
    }

    if (run.kind === 'QUESTION') {
      return this.questionSyncQueue.enqueue(
        run.connection.storeId,
        run.connection.id,
        {
          trigger: 'RETRY',
          retryOfId: run.id,
        },
      );
    }

    return this.productSyncQueue.enqueue(
      run.connection.storeId,
      run.connection.id,
      run.kind,
      {
        trigger: 'RETRY',
        retryOfId: run.id,
      },
    );
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
      select: { id: true, removedAt: true },
    });

    if (existingConnection && !existingConnection.removedAt) {
      throw new ConflictException('Bu satış kanalı mağazaya zaten eklenmiş.');
    }

    await this.providers.verifyCredentials(dto.providerKey, {
      environment: dto.environment,
      credentials,
    });

    if (existingConnection) {
      return this.prisma.channelConnection.update({
        where: { id: existingConnection.id },
        data: {
          type: manifest.type,
          environment: dto.environment,
          credentialsEncrypted: this.encryption.encrypt(credentials),
          credentialSchemaVersion: 1,
          status: ChannelConnectionStatus.CONNECTED,
          connectedAt: new Date(),
          processingStartedAt: null,
          lastSyncAt: null,
          lastInventorySyncAt: null,
          failureReason: null,
          questionSyncStartedAt: null,
          lastQuestionSyncAt: null,
          questionSyncFailureReason: null,
          removedAt: null,
        },
        select: channelConnectionSelect,
      });
    }

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
    try {
      await this.providers.verifyCredentials(connection.providerKey, {
        environment: connection.environment,
        credentials,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Kanal bağlantısı doğrulanamadı.';
      await this.prisma.channelConnection.updateMany({
        where: { id: connectionId, storeId },
        data: {
          status: ChannelConnectionStatus.ERROR,
          failureReason: message.slice(0, 1_000),
        },
      });
      await this.notifications.createChannelConnectionError(
        storeId,
        connectionId,
      );
      throw error;
    }

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
    const connection = await this.prisma.channelConnection.findFirst({
      where: { id: connectionId, storeId, removedAt: null },
      select: {
        id: true,
        processingStartedAt: true,
        questionSyncStartedAt: true,
        syncRuns: {
          where: { status: CatalogSyncStatus.RUNNING },
          take: 1,
          select: { id: true },
        },
        questionAnswers: {
          where: { status: QuestionAnswerStatus.PROCESSING },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!connection) {
      throw new NotFoundException('Satış kanalı bağlantısı bulunamadı.');
    }

    if (
      connection.processingStartedAt ||
      connection.questionSyncStartedAt ||
      connection.syncRuns.length > 0 ||
      connection.questionAnswers.length > 0
    ) {
      throw new ConflictException(
        'Devam eden senkronizasyon veya cevap gönderimi tamamlandıktan sonra kanalı kaldırabilirsiniz.',
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      const store = await transaction.store.findUniqueOrThrow({
        where: { id: storeId },
        select: { inventoryPolicy: true },
      });
      await transaction.$executeRaw`
        UPDATE "product_question" AS question
        SET
          "productTitleSnapshot" = COALESCE(question."productTitleSnapshot", product."title"),
          "productImageUrlSnapshot" = COALESCE(
            question."productImageUrlSnapshot",
            (
              SELECT image."url"
              FROM "product_image" AS image
              WHERE image."productId" = product."id"
              ORDER BY image."position" ASC, image."createdAt" ASC
              LIMIT 1
            )
          )
        FROM "product" AS product
        WHERE
          question."connectionId" = ${connectionId}
          AND question."productId" = product."id"
      `;

      await transaction.questionAnswer.updateMany({
        where: {
          connectionId,
          status: QuestionAnswerStatus.QUEUED,
        },
        data: {
          status: QuestionAnswerStatus.FAILED,
          processingStartedAt: null,
          lastError: 'Kanal bağlantısı kaldırıldığı için cevap gönderilmedi.',
        },
      });

      await transaction.productQuestion.updateMany({
        where: { connectionId },
        data: {
          productId: null,
          externalProductRecordId: null,
          draftProcessingStatus: null,
          draftProcessingError: null,
          draftQueuedAt: null,
          draftProcessingStartedAt: null,
        },
      });
      await transaction.productQuestion.updateMany({
        where: {
          connectionId,
          status: {
            in: [ProductQuestionStatus.PENDING, ProductQuestionStatus.DRAFTED],
          },
        },
        data: { status: ProductQuestionStatus.IGNORED },
      });

      const externalProducts = await transaction.externalProduct.findMany({
        where: { connectionId },
        select: {
          productId: true,
          variants: { select: { productVariantId: true } },
        },
      });
      const productIds = [
        ...new Set(externalProducts.map((product) => product.productId)),
      ];
      const variantIds = [
        ...new Set(
          externalProducts.flatMap((product) =>
            product.variants.map((variant) => variant.productVariantId),
          ),
        ),
      ];

      await transaction.productSizeGuide.deleteMany({
        where: { externalProduct: { connectionId } },
      });
      await transaction.externalProduct.deleteMany({
        where: { connectionId },
      });

      if (variantIds.length > 0) {
        await transaction.productVariant.deleteMany({
          where: {
            id: { in: variantIds },
            externalVariants: { none: {} },
          },
        });
      }
      if (productIds.length > 0) {
        await transaction.product.deleteMany({
          where: {
            id: { in: productIds },
            externalProducts: { none: {} },
          },
        });
      }

      await recalculateStoreVariantInventory(
        transaction,
        storeId,
        store.inventoryPolicy ?? InventoryPolicy.SHARED,
      );

      await transaction.channelConnection.update({
        where: { id: connectionId },
        data: {
          status: ChannelConnectionStatus.DISCONNECTED,
          credentialsEncrypted: null,
          processingStartedAt: null,
          failureReason: null,
          questionSyncStartedAt: null,
          questionSyncFailureReason: null,
          removedAt: new Date(),
        },
      });
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
      where: { id: connectionId, storeId, removedAt: null },
      select: { id: true },
    });

    if (!connection) {
      throw new NotFoundException('Satış kanalı bağlantısı bulunamadı.');
    }
  }

  private async getConnection(storeId: string, connectionId: string) {
    const connection = await this.prisma.channelConnection.findFirst({
      where: { id: connectionId, storeId, removedAt: null },
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

function normalizeSyncStage(
  status: CatalogSyncStatus,
  stage: CatalogSyncStage,
) {
  if (status === CatalogSyncStatus.COMPLETED) return CatalogSyncStage.COMPLETED;
  if (status === CatalogSyncStatus.FAILED) return CatalogSyncStage.FAILED;
  return stage;
}

function normalizeSyncProgress(status: CatalogSyncStatus, progress: number) {
  return status === CatalogSyncStatus.RUNNING ? progress : 100;
}
