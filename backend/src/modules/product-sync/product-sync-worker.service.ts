import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  CatalogSyncStatus,
  AiAutomationMode,
  ChannelConnectionStatus,
  ExternalEntityStatus,
  InventoryPolicy,
  NotificationSeverity,
  NotificationType,
  ProductIdentityType,
  ProductStatus,
  ProductVariantStatus,
  StoreStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { CredentialsEncryptionService } from '../channels/credentials-encryption.service';
import type {
  NormalizedInventoryVariant,
  NormalizedProduct,
  NormalizedProductVariant,
} from '../channels/providers/catalog-connector';
import { ProviderRegistryService } from '../channels/providers/provider-registry.service';
import { isProviderAuthenticationError } from '../channels/providers/connector-utils';
import { SizeGuideDispatcher } from '../size-guides/size-guide.types';
import { NotificationsService } from '../notifications/notifications.service';
import { QuestionProductLinkService } from '../question-product-link/question-product-link.service';
import { QUESTION_DRAFT_DISPATCHER } from '../questions/question-draft.constants';
import { BillingEntitlementService } from '../billing/billing-entitlement.service';
import {
  BillingAccessRequiredException,
  BillingPlanLimitException,
} from '../billing/billing.errors';
import { BillingSubscriptionService } from '../billing/billing-subscription.service';
import { BILLING_SYNC_STOPPED_MESSAGE } from '../billing/billing-access.policy';
import { AuditAction } from '../audit/audit-actions';
import {
  AuditActorType,
  AuditLogService,
  AuditOrigin,
  AuditResult,
  auditErrorCode,
} from '../audit/audit-log.service';
import type { QuestionDraftDispatcher } from '../questions/question-draft.types';
import {
  PRODUCT_SYNC_BATCHES_PER_JOB,
  PRODUCT_SYNC_EXPECTED_MAX_BATCHES,
  PRODUCT_SYNC_MAX_BATCHES,
  PRODUCT_SYNC_RECONCILIATION_TIMEOUT_MS,
} from './product-sync.constants';
import type {
  ProductSyncJobData,
  ProductSyncRunResult,
} from './product-sync.types';
import { recalculateStoreVariantInventory } from './inventory-policy';

type SyncConnection = {
  id: string;
  providerKey: string;
  environment: 'SANDBOX' | 'PRODUCTION';
  credentialsEncrypted: string;
};

type SyncCounters = {
  productsProcessed: number;
  variantsProcessed: number;
  productsArchived: number;
  productsCreated: number;
  productsUpdated: number;
  productsUnchanged: number;
  productsSkipped: number;
  variantsUpdated: number;
  variantsUnchanged: number;
  lowStockAlerts: number;
  outOfStockAlerts: number;
};

type ProductChange = 'CREATED' | 'UPDATED' | 'UNCHANGED';
type InventoryChange = 'UPDATED' | 'UNCHANGED';
type StockAlert = 'LOW_STOCK' | 'OUT_OF_STOCK';
type InventoryUpdateResult = {
  change: InventoryChange;
  stockAlert: StockAlert | null;
};
type ProductIdentityCandidate = {
  type: ProductIdentityType;
  value: string;
};

type SyncCheckpoint = SyncCounters & {
  status: CatalogSyncStatus;
  cursor: string | null;
  batchesProcessed: number;
  fetchCompleted: boolean;
  progress: number;
};

type SyncChunkResult = {
  counters: SyncCounters;
  continuationBatch: number | null;
};

@Injectable()
export class ProductSyncWorkerService {
  private readonly logger = new Logger(ProductSyncWorkerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderRegistryService,
    private readonly encryption: CredentialsEncryptionService,
    private readonly sizeGuides: SizeGuideDispatcher,
    private readonly notifications: NotificationsService,
    private readonly productLinks: QuestionProductLinkService,
    private readonly billingEntitlements: BillingEntitlementService,
    @Inject(QUESTION_DRAFT_DISPATCHER)
    private readonly questionDrafts: QuestionDraftDispatcher,
    private readonly billing: BillingSubscriptionService,
    private readonly audit: AuditLogService,
  ) {}

  async run(
    data: ProductSyncJobData,
    updateProgress: (progress: number) => Promise<void>,
  ): Promise<ProductSyncRunResult> {
    await this.billing.assertStoreAccess(
      data.storeId,
      BILLING_SYNC_STOPPED_MESSAGE,
    );

    const checkpoint = await this.loadCheckpoint(data);
    if (!checkpoint) {
      throw new Error('Senkronizasyon kaydı bulunamadı.');
    }

    if (checkpoint.status !== CatalogSyncStatus.RUNNING) {
      return { continuationBatch: null };
    }

    if (
      !checkpoint.fetchCompleted &&
      checkpoint.batchesProcessed >= PRODUCT_SYNC_MAX_BATCHES
    ) {
      throw new Error(
        'Senkronizasyon sağlayıcı kayıt güvenlik sınırına ulaştı.',
      );
    }

    if (
      data.checkpointBatch !== undefined &&
      data.checkpointBatch > checkpoint.batchesProcessed
    ) {
      throw new Error('Senkronizasyon checkpoint sırası geçersiz.');
    }

    if (
      data.checkpointBatch !== undefined &&
      data.checkpointBatch < checkpoint.batchesProcessed &&
      !checkpoint.fetchCompleted
    ) {
      return { continuationBatch: checkpoint.batchesProcessed };
    }

    const progress = Math.max(10, checkpoint.progress);
    await this.prisma.catalogSyncRun.updateMany({
      where: { id: data.syncRunId, connectionId: data.connectionId },
      data: checkpoint.fetchCompleted
        ? { stage: 'RECONCILING' }
        : { stage: 'FETCHING', progress },
    });
    await updateProgress(progress);

    const connection = await this.prisma.channelConnection.findFirst({
      where: {
        id: data.connectionId,
        storeId: data.storeId,
        status: data.recoverErroredConnection
          ? {
              in: [
                ChannelConnectionStatus.CONNECTED,
                ChannelConnectionStatus.ERROR,
              ],
            }
          : ChannelConnectionStatus.CONNECTED,
        store: { status: StoreStatus.ACTIVE },
      },
      select: {
        id: true,
        providerKey: true,
        environment: true,
        credentialsEncrypted: true,
      },
    });

    if (!connection?.credentialsEncrypted) {
      throw new Error(
        'Kanal bağlantısı veya şifrelenmiş API bilgileri bulunamadı.',
      );
    }

    const syncConnection = connection as SyncConnection;
    const credentials = this.encryption.decrypt(
      syncConnection.credentialsEncrypted,
    );
    const chunk =
      data.kind === 'INVENTORY'
        ? await this.syncInventory(
            data,
            syncConnection,
            credentials,
            checkpoint,
            updateProgress,
          )
        : await this.syncFullCatalog(
            data,
            syncConnection,
            credentials,
            checkpoint,
            updateProgress,
          );

    if (chunk.continuationBatch !== null) {
      return { continuationBatch: chunk.continuationBatch };
    }

    await this.billing.assertStoreAccess(
      data.storeId,
      BILLING_SYNC_STOPPED_MESSAGE,
    );
    if (data.kind === 'FULL') {
      await this.reconcileQuestionProductLinks(data, updateProgress);
    }

    await this.completeSync(data, chunk.counters);
    await this.notifyProductLimit(data, chunk.counters);
    await this.notifyInventoryAlerts(data, chunk.counters);
    await updateProgress(100);
    return { continuationBatch: null };
  }

  async markFinalFailure(data: ProductSyncJobData, error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Ürün senkronizasyonu başarısız.';
    const authenticationError = isProviderAuthenticationError(error);
    const planLimitError = error instanceof BillingPlanLimitException;
    const accessError = error instanceof BillingAccessRequiredException;
    const connectionData =
      (data.kind === 'FULL' && !planLimitError && !accessError) ||
      authenticationError
        ? {
            status: ChannelConnectionStatus.ERROR,
            processingStartedAt: null,
            failureReason: message,
          }
        : {
            processingStartedAt: null,
            failureReason: message,
          };

    await this.prisma.$transaction(async (transaction) => {
      const store = await transaction.store.findUniqueOrThrow({
        where: { id: data.storeId },
        select: { workspaceId: true },
      });
      await transaction.catalogSyncRun.updateMany({
        where: { id: data.syncRunId },
        data: {
          status: CatalogSyncStatus.FAILED,
          stage: 'FAILED',
          progress: 100,
          errorMessage: message,
          completedAt: new Date(),
        },
      });
      await transaction.channelConnection.updateMany({
        where: { id: data.connectionId },
        data: connectionData,
      });
      await this.audit.record(
        {
          actorType: AuditActorType.SYSTEM,
          origin: AuditOrigin.WORKER,
          action: AuditAction.CATALOG_SYNC_FAILED,
          result: AuditResult.FAILURE,
          workspaceId: store.workspaceId,
          storeId: data.storeId,
          targetType: 'CATALOG_SYNC_RUN',
          targetId: data.syncRunId,
          errorCode: auditErrorCode(error),
          metadata: {
            kind: data.kind,
            connectionId: data.connectionId,
            authenticationError,
            planLimitError,
            accessError,
          },
        },
        transaction,
      );
    });

    if (accessError) {
      await this.notifications.createForStoreMembers({
        storeId: data.storeId,
        type: NotificationType.PRODUCT_SYNC_FAILED,
        severity: NotificationSeverity.WARNING,
        title: 'Senkronizasyon durduruldu',
        message: BILLING_SYNC_STOPPED_MESSAGE,
        actionUrl: '/billing',
        entityType: 'CATALOG_SYNC_RUN',
        entityId: data.syncRunId,
        dedupeKey: `billing-sync-inactive:${data.connectionId}`,
      });
      return;
    }

    if (planLimitError) {
      await this.notifications.createForStoreMembers({
        storeId: data.storeId,
        type: NotificationType.BILLING_PLAN_LIMIT,
        severity: NotificationSeverity.WARNING,
        title: 'Ürün kapasitesi doldu',
        message:
          'Yeni ürünler içe aktarılamadı. Mevcut ürünleri güncellemeye devam edebilir veya planınızı yükseltebilirsiniz.',
        actionUrl: '/billing',
        entityType: 'CATALOG_SYNC_RUN',
        entityId: data.syncRunId,
        dedupeKey: `billing-product-limit:${data.connectionId}`,
      });
      return;
    }

    const inventorySync = data.kind === 'INVENTORY';
    await this.notifications.createForStoreMembers({
      storeId: data.storeId,
      type: NotificationType.PRODUCT_SYNC_FAILED,
      severity: NotificationSeverity.ERROR,
      title: inventorySync
        ? 'Stok senkronizasyonu başarısız'
        : 'Ürün senkronizasyonu başarısız',
      message: inventorySync
        ? 'Pazaryerindeki güncel stok bilgileri alınamadı. Senkronizasyon geçmişini inceleyin.'
        : 'Pazaryerindeki ürünler güncellenemedi. Senkronizasyon geçmişini inceleyin.',
      actionUrl: `/dashboard/channels/sync?status=failed&kind=${data.kind.toLowerCase()}`,
      entityType: 'CATALOG_SYNC_RUN',
      entityId: data.syncRunId,
      dedupeKey: `product-sync-failed:${data.connectionId}:${data.kind}`,
    });

    if (authenticationError) {
      await this.notifications.createChannelConnectionError(
        data.storeId,
        data.connectionId,
      );
    }
  }

  private async syncFullCatalog(
    data: ProductSyncJobData,
    connection: SyncConnection,
    credentials: Record<string, string>,
    checkpoint: SyncCheckpoint,
    updateProgress: (progress: number) => Promise<void>,
  ): Promise<SyncChunkResult> {
    let cursor = checkpoint.cursor ?? undefined;
    let productsProcessed = checkpoint.productsProcessed;
    let variantsProcessed = checkpoint.variantsProcessed;
    let batchesProcessed = checkpoint.batchesProcessed;
    let productsCreated = checkpoint.productsCreated;
    let productsUpdated = checkpoint.productsUpdated;
    let productsUnchanged = checkpoint.productsUnchanged;
    let productsSkipped = checkpoint.productsSkipped;
    let capacityError: BillingPlanLimitException | undefined;
    let chunkBatches = 0;

    if (!checkpoint.fetchCompleted) {
      do {
        await this.billing.assertStoreAccess(
          data.storeId,
          BILLING_SYNC_STOPPED_MESSAGE,
        );
        const requestedCursor = cursor;
        const batch = await this.providers.fetchProducts(
          connection.providerKey,
          { environment: connection.environment, credentials },
          requestedCursor,
        );
        assertCursorAdvanced(requestedCursor, batch.nextCursor);

        await this.billing.assertStoreAccess(
          data.storeId,
          BILLING_SYNC_STOPPED_MESSAGE,
        );
        for (const product of batch.products) {
          try {
            const change = await this.saveNormalizedProduct(
              data.storeId,
              connection.id,
              data.syncRunId,
              product,
              capacityError,
            );
            if (change === 'CREATED') productsCreated += 1;
            if (change === 'UPDATED') productsUpdated += 1;
            if (change === 'UNCHANGED') productsUnchanged += 1;
            productsProcessed += 1;
            variantsProcessed += uniqueVariants(product.variants).length;
          } catch (error) {
            if (!(error instanceof BillingPlanLimitException)) throw error;
            capacityError = error;
            productsSkipped += 1;
          }
        }

        cursor = batch.nextCursor;
        chunkBatches += 1;
        batchesProcessed += 1;
        const progress = fetchProgress(batchesProcessed, batch.progress);
        await this.updateRunProgress(data.connectionId, data.syncRunId, {
          productsProcessed,
          variantsProcessed,
          productsCreated,
          productsUpdated,
          productsUnchanged,
          productsSkipped,
          variantsUpdated: checkpoint.variantsUpdated,
          variantsUnchanged: checkpoint.variantsUnchanged,
          lowStockAlerts: checkpoint.lowStockAlerts,
          outOfStockAlerts: checkpoint.outOfStockAlerts,
          batchesProcessed,
          fetchCompleted: !cursor,
          stage: 'PERSISTING',
          progress,
          cursor,
        });
        await updateProgress(progress);

        if (cursor && batchesProcessed >= PRODUCT_SYNC_MAX_BATCHES) {
          throw new Error(
            'Katalog senkronizasyonu sağlayıcı kayıt güvenlik sınırını aştı.',
          );
        }
      } while (cursor && chunkBatches < PRODUCT_SYNC_BATCHES_PER_JOB);
    }

    const counters: SyncCounters = {
      productsProcessed,
      variantsProcessed,
      productsArchived: checkpoint.productsArchived,
      productsCreated,
      productsUpdated,
      productsUnchanged,
      productsSkipped,
      variantsUpdated: 0,
      variantsUnchanged: 0,
      lowStockAlerts: 0,
      outOfStockAlerts: 0,
    };

    if (cursor) {
      return { counters, continuationBatch: batchesProcessed };
    }

    await this.billing.assertStoreAccess(
      data.storeId,
      BILLING_SYNC_STOPPED_MESSAGE,
    );
    await this.prisma.catalogSyncRun.update({
      where: { id: data.syncRunId },
      data: { stage: 'RECONCILING', progress: 90 },
    });
    await updateProgress(90);

    const productsArchived = await this.reconcileMissingProducts(
      data.storeId,
      connection.id,
      data.syncRunId,
    );
    counters.productsArchived = Math.max(
      checkpoint.productsArchived,
      productsArchived,
    );
    await this.prisma.catalogSyncRun.update({
      where: { id: data.syncRunId },
      data: { productsArchived: counters.productsArchived },
    });

    return { counters, continuationBatch: null };
  }

  private async syncInventory(
    data: ProductSyncJobData,
    connection: SyncConnection,
    credentials: Record<string, string>,
    checkpoint: SyncCheckpoint,
    updateProgress: (progress: number) => Promise<void>,
  ): Promise<SyncChunkResult> {
    let cursor = checkpoint.cursor ?? undefined;
    let variantsProcessed = checkpoint.variantsProcessed;
    let batchesProcessed = checkpoint.batchesProcessed;
    let variantsUpdated = checkpoint.variantsUpdated;
    let variantsUnchanged = checkpoint.variantsUnchanged;
    let lowStockAlerts = checkpoint.lowStockAlerts;
    let outOfStockAlerts = checkpoint.outOfStockAlerts;
    let chunkBatches = 0;

    if (!checkpoint.fetchCompleted) {
      do {
        await this.billing.assertStoreAccess(
          data.storeId,
          BILLING_SYNC_STOPPED_MESSAGE,
        );
        const requestedCursor = cursor;
        const batch = await this.providers.fetchInventory(
          connection.providerKey,
          { environment: connection.environment, credentials },
          requestedCursor,
        );
        assertCursorAdvanced(requestedCursor, batch.nextCursor);

        await this.billing.assertStoreAccess(
          data.storeId,
          BILLING_SYNC_STOPPED_MESSAGE,
        );
        for (const variant of batch.variants) {
          const result = await this.updateInventoryVariant(
            connection.id,
            variant,
          );
          if (result) variantsProcessed += 1;
          if (result?.change === 'UPDATED') variantsUpdated += 1;
          if (result?.change === 'UNCHANGED') variantsUnchanged += 1;
          if (result?.stockAlert === 'LOW_STOCK') lowStockAlerts += 1;
          if (result?.stockAlert === 'OUT_OF_STOCK') outOfStockAlerts += 1;
        }

        cursor = batch.nextCursor;
        chunkBatches += 1;
        batchesProcessed += 1;
        const progress = fetchProgress(batchesProcessed, batch.progress);
        await this.updateRunProgress(data.connectionId, data.syncRunId, {
          productsProcessed: checkpoint.productsProcessed,
          variantsProcessed,
          productsCreated: checkpoint.productsCreated,
          productsUpdated: checkpoint.productsUpdated,
          productsUnchanged: checkpoint.productsUnchanged,
          productsSkipped: checkpoint.productsSkipped,
          variantsUpdated,
          variantsUnchanged,
          lowStockAlerts,
          outOfStockAlerts,
          batchesProcessed,
          fetchCompleted: !cursor,
          stage: 'PERSISTING',
          progress,
          cursor,
        });
        await updateProgress(progress);

        if (cursor && batchesProcessed >= PRODUCT_SYNC_MAX_BATCHES) {
          throw new Error(
            'Envanter senkronizasyonu sağlayıcı kayıt güvenlik sınırını aştı.',
          );
        }
      } while (cursor && chunkBatches < PRODUCT_SYNC_BATCHES_PER_JOB);
    }

    const counters: SyncCounters = {
      productsProcessed: 0,
      variantsProcessed,
      productsArchived: 0,
      productsCreated: 0,
      productsUpdated: 0,
      productsUnchanged: 0,
      productsSkipped: 0,
      variantsUpdated,
      variantsUnchanged,
      lowStockAlerts,
      outOfStockAlerts,
    };

    return {
      counters,
      continuationBatch: cursor ? batchesProcessed : null,
    };
  }

  private async saveNormalizedProduct(
    storeId: string,
    connectionId: string,
    syncRunId: string,
    normalized: NormalizedProduct,
    capacityError?: BillingPlanLimitException,
  ) {
    const saved = await this.prisma.$transaction(async (transaction) => {
      const syncedAt = new Date();
      const attributes = uniqueAttributes(normalized.attributes);
      const images = [...new Set(normalized.images.filter(Boolean))];
      const variants = uniqueVariants(normalized.variants);
      const identityCandidates = getProductIdentityCandidates(normalized);
      const store = await transaction.store.findUniqueOrThrow({
        where: { id: storeId },
        select: { inventoryPolicy: true },
      });
      const inventoryPolicy = store.inventoryPolicy ?? InventoryPolicy.SHARED;
      const existingExternalProduct =
        await transaction.externalProduct.findUnique({
          where: {
            connectionId_externalId: {
              connectionId,
              externalId: normalized.externalId,
            },
          },
          select: {
            id: true,
            productId: true,
            rawPayload: true,
            sourceUpdatedAt: true,
          },
        });
      const canonicalProductId = await this.resolveCanonicalProduct(
        transaction,
        storeId,
        existingExternalProduct?.productId,
        identityCandidates,
        normalized.brand,
        variants,
      );
      const change: ProductChange = !existingExternalProduct
        ? 'CREATED'
        : isSameProductSnapshot(existingExternalProduct, normalized)
          ? 'UNCHANGED'
          : 'UPDATED';
      const productData = {
        title: normalized.title,
        description: normalized.description ?? null,
        brand: normalized.brand ?? null,
        category: normalized.category ?? null,
        status: ProductStatus.ACTIVE,
      };
      let productId: string;
      let externalProductId: string;

      if (existingExternalProduct) {
        productId = canonicalProductId ?? existingExternalProduct.productId;
        externalProductId = existingExternalProduct.id;
        await this.assertProductActivationCapacity(
          transaction,
          storeId,
          productId,
          capacityError,
        );
        await transaction.product.update({
          where: { id: productId },
          data: {
            ...productData,
            attributes: {
              deleteMany: {},
              create: attributes,
            },
            images: {
              deleteMany: {},
              create: images.map((url, position) => ({
                url,
                position,
              })),
            },
          },
        });
        await transaction.externalProduct.update({
          where: { id: externalProductId },
          data: {
            productId,
            externalUrl: normalized.externalUrl ?? null,
            rawPayload: normalized.rawPayload as Prisma.InputJsonValue,
            status: ExternalEntityStatus.ACTIVE,
            lastSeenSyncId: syncRunId,
            sourceUpdatedAt: normalized.sourceUpdatedAt,
            lastSyncedAt: syncedAt,
          },
        });
      } else if (canonicalProductId) {
        productId = canonicalProductId;
        await this.assertProductActivationCapacity(
          transaction,
          storeId,
          productId,
          capacityError,
        );
        await transaction.product.update({
          where: { id: productId },
          data: {
            ...productData,
            attributes: {
              deleteMany: {},
              create: attributes,
            },
            images: {
              deleteMany: {},
              create: images.map((url, position) => ({
                url,
                position,
              })),
            },
          },
        });
        const externalProduct = await transaction.externalProduct.create({
          data: {
            connectionId,
            productId,
            externalId: normalized.externalId,
            externalUrl: normalized.externalUrl,
            rawPayload: normalized.rawPayload as Prisma.InputJsonValue,
            status: ExternalEntityStatus.ACTIVE,
            lastSeenSyncId: syncRunId,
            sourceUpdatedAt: normalized.sourceUpdatedAt,
            lastSyncedAt: syncedAt,
          },
          select: { id: true },
        });
        externalProductId = externalProduct.id;
      } else {
        await this.assertProductActivationCapacity(
          transaction,
          storeId,
          undefined,
          capacityError,
        );
        const product = await transaction.product.create({
          data: {
            storeId,
            ...productData,
            attributes: { create: attributes },
            images: {
              create: images.map((url, position) => ({
                url,
                position,
              })),
            },
          },
          select: { id: true },
        });
        const externalProduct = await transaction.externalProduct.create({
          data: {
            connectionId,
            productId: product.id,
            externalId: normalized.externalId,
            externalUrl: normalized.externalUrl,
            rawPayload: normalized.rawPayload as Prisma.InputJsonValue,
            status: ExternalEntityStatus.ACTIVE,
            lastSeenSyncId: syncRunId,
            sourceUpdatedAt: normalized.sourceUpdatedAt,
            lastSyncedAt: syncedAt,
          },
          select: { id: true },
        });
        productId = product.id;
        externalProductId = externalProduct.id;
      }

      if (identityCandidates.length > 0) {
        await transaction.productIdentity.createMany({
          data: identityCandidates.map((identity) => ({
            storeId,
            productId,
            ...identity,
          })),
          skipDuplicates: true,
        });

        productId =
          (await this.resolveCanonicalProduct(
            transaction,
            storeId,
            productId,
            identityCandidates,
            normalized.brand,
            variants,
          )) ?? productId;
      }

      for (const variant of variants) {
        await this.upsertVariant(
          transaction,
          productId,
          externalProductId,
          syncRunId,
          variant,
          syncedAt,
          inventoryPolicy,
        );
      }

      await this.reconcileMissingVariants(
        transaction,
        externalProductId,
        syncRunId,
        inventoryPolicy,
      );

      return { productId, externalProductId, change };
    });

    if (normalized.sizeGuide) {
      try {
        await this.sizeGuides.register({
          ...saved,
          sizeGuide: normalized.sizeGuide,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Bilinmeyen kuyruk hatası';
        this.logger.warn(
          `${normalized.externalId} beden tablosu kuyruğa eklenemedi: ${message}`,
        );
      }
    }

    return saved.change;
  }

  private async assertProductActivationCapacity(
    transaction: Prisma.TransactionClient,
    storeId: string,
    productId?: string,
    capacityError?: BillingPlanLimitException,
  ) {
    if (productId) {
      const product = await transaction.product.findUnique({
        where: { id: productId },
        select: { status: true },
      });
      if (product?.status === ProductStatus.ACTIVE) return;
    }

    if (capacityError) throw capacityError;

    await this.billingEntitlements.assertProductCapacityForStoreInTransaction(
      transaction,
      storeId,
    );
  }

  private async resolveCanonicalProduct(
    transaction: Prisma.TransactionClient,
    storeId: string,
    currentProductId: string | undefined,
    identities: ProductIdentityCandidate[],
    brand: string | undefined,
    variants: NormalizedProductVariant[],
  ) {
    const identityMatches =
      identities.length === 0
        ? []
        : await transaction.productIdentity.findMany({
            where: {
              storeId,
              OR: identities.map((identity) => ({
                type: identity.type,
                value: identity.value,
              })),
            },
            select: { productId: true },
          });
    const variantProductMatches = await this.findVariantProductMatches(
      transaction,
      storeId,
      currentProductId,
      brand,
      variants,
    );
    const candidateIds = [
      ...new Set([
        ...(currentProductId ? [currentProductId] : []),
        ...identityMatches.map((identity) => identity.productId),
        ...variantProductMatches,
      ]),
    ];

    if (candidateIds.length === 0) return null;

    const candidates = await transaction.product.findMany({
      where: { id: { in: candidateIds }, storeId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    const canonicalProductId = candidates[0]?.id;

    if (!canonicalProductId) return null;

    const duplicateProductIds = candidates
      .slice(1)
      .map((product) => product.id);

    if (duplicateProductIds.length > 0) {
      await this.mergeProducts(
        transaction,
        canonicalProductId,
        duplicateProductIds,
      );
    }

    return canonicalProductId;
  }

  private async findVariantProductMatches(
    transaction: Prisma.TransactionClient,
    storeId: string,
    currentProductId: string | undefined,
    brand: string | undefined,
    variants: NormalizedProductVariant[],
  ) {
    const excludedCurrentProduct = currentProductId
      ? { not: currentProductId }
      : undefined;
    const barcodes = [
      ...new Set(
        variants
          .map((variant) => variant.barcode?.trim())
          .filter((barcode): barcode is string => Boolean(barcode)),
      ),
    ];

    if (barcodes.length > 0) {
      const barcodeMatches = await transaction.productVariant.findMany({
        where: {
          productId: excludedCurrentProduct,
          barcode: { in: barcodes },
          status: { not: ProductVariantStatus.ARCHIVED },
          product: { storeId, status: { not: ProductStatus.ARCHIVED } },
        },
        select: { productId: true },
      });
      const matchingProductIds = [
        ...new Set(barcodeMatches.map((match) => match.productId)),
      ];

      if (matchingProductIds.length > 0) return matchingProductIds;
    }

    const normalizedBrand = brand?.trim();
    const skuOptions = variants
      .filter((variant) => variant.sku.trim().length >= 3)
      .map(
        (variant) =>
          ({
            sku: { equals: variant.sku.trim(), mode: 'insensitive' },
            color: variant.color?.trim()
              ? { equals: variant.color.trim(), mode: 'insensitive' }
              : null,
            size: variant.size?.trim()
              ? { equals: variant.size.trim(), mode: 'insensitive' }
              : null,
          }) satisfies Prisma.ProductVariantWhereInput,
      );

    if (!normalizedBrand || skuOptions.length === 0) return [];

    const skuMatches = await transaction.productVariant.findMany({
      where: {
        productId: excludedCurrentProduct,
        status: { not: ProductVariantStatus.ARCHIVED },
        product: {
          storeId,
          status: { not: ProductStatus.ARCHIVED },
          brand: { equals: normalizedBrand, mode: 'insensitive' },
        },
        OR: skuOptions,
      },
      select: { productId: true },
    });
    const matchingProductIds = [
      ...new Set(skuMatches.map((match) => match.productId)),
    ];

    return matchingProductIds.length === 1 ? matchingProductIds : [];
  }

  private async mergeProducts(
    transaction: Prisma.TransactionClient,
    canonicalProductId: string,
    duplicateProductIds: string[],
  ) {
    const duplicateKnowledgeFacts =
      await transaction.productKnowledgeFact.findMany({
        where: { productId: { in: duplicateProductIds } },
        select: {
          storeId: true,
          variantId: true,
          scopeKey: true,
          factType: true,
          normalizedKey: true,
          label: true,
          value: true,
          status: true,
          verifiedByUserId: true,
          originatingQuestionId: true,
          verifiedAt: true,
          archivedAt: true,
        },
      });

    await transaction.productVariant.updateMany({
      where: { productId: { in: duplicateProductIds } },
      data: { productId: canonicalProductId },
    });

    await transaction.productSizeGuide.updateMany({
      where: { productId: { in: duplicateProductIds } },
      data: { productId: canonicalProductId },
    });
    await transaction.externalProduct.updateMany({
      where: { productId: { in: duplicateProductIds } },
      data: { productId: canonicalProductId },
    });
    await transaction.productQuestion.updateMany({
      where: { productId: { in: duplicateProductIds } },
      data: { productId: canonicalProductId },
    });
    if (duplicateKnowledgeFacts.length > 0) {
      await transaction.productKnowledgeFact.createMany({
        data: duplicateKnowledgeFacts.map((fact) => ({
          ...fact,
          productId: canonicalProductId,
        })),
        skipDuplicates: true,
      });
    }
    await transaction.productIdentity.updateMany({
      where: { productId: { in: duplicateProductIds } },
      data: { productId: canonicalProductId },
    });
    await transaction.product.deleteMany({
      where: { id: { in: duplicateProductIds } },
    });
  }

  private async upsertVariant(
    transaction: Prisma.TransactionClient,
    productId: string,
    externalProductId: string,
    syncRunId: string,
    normalized: NormalizedProductVariant,
    syncedAt: Date,
    inventoryPolicy: InventoryPolicy,
  ) {
    const externalVariant = await transaction.externalProductVariant.findUnique(
      {
        where: {
          externalProductId_externalId: {
            externalProductId,
            externalId: normalized.externalId,
          },
        },
        select: {
          id: true,
          productVariantId: true,
          sourceUpdatedAt: true,
        },
      },
    );
    const shouldUpdateInventory =
      !externalVariant?.sourceUpdatedAt ||
      !normalized.sourceUpdatedAt ||
      normalized.sourceUpdatedAt >= externalVariant.sourceUpdatedAt;
    const fullVariantData = {
      title: normalized.title ?? null,
      sku: normalized.sku,
      barcode: normalized.barcode ?? null,
      color: normalized.color ?? null,
      size: normalized.size ?? null,
      price: normalized.price,
      currency: normalized.currency,
      stock: normalized.stock,
      status:
        normalized.stock > 0
          ? ProductVariantStatus.ACTIVE
          : ProductVariantStatus.OUT_OF_STOCK,
      sourceUpdatedAt: normalized.sourceUpdatedAt,
      lastSyncedAt: syncedAt,
    };
    const variantUpdateData = shouldUpdateInventory
      ? fullVariantData
      : {
          title: normalized.title ?? null,
          sku: normalized.sku,
          barcode: normalized.barcode ?? null,
          color: normalized.color ?? null,
          size: normalized.size ?? null,
          lastSyncedAt: syncedAt,
        };
    let productVariantId: string;

    if (externalVariant) {
      productVariantId = await this.resolveCanonicalVariant(
        transaction,
        productId,
        externalVariant.productVariantId,
        normalized,
      );
      await transaction.productVariant.update({
        where: { id: productVariantId },
        data: variantUpdateData,
      });
      await transaction.externalProductVariant.update({
        where: { id: externalVariant.id },
        data: {
          sku: normalized.sku,
          barcode: normalized.barcode ?? null,
          ...(shouldUpdateInventory
            ? {
                price: normalized.price,
                currency: normalized.currency,
                stock: normalized.stock,
              }
            : {}),
          status: ExternalEntityStatus.ACTIVE,
          lastSeenSyncId: syncRunId,
          sourceUpdatedAt: normalized.sourceUpdatedAt,
          lastSyncedAt: syncedAt,
        },
      });
      await this.refreshCanonicalVariantInventory(
        transaction,
        productVariantId,
        inventoryPolicy,
      );
      return;
    }

    productVariantId =
      (await this.resolveMatchingVariant(transaction, productId, normalized)) ??
      (
        await transaction.productVariant.create({
          data: { productId, ...fullVariantData },
          select: { id: true },
        })
      ).id;

    await transaction.productVariant.update({
      where: { id: productVariantId },
      data: variantUpdateData,
    });

    await transaction.externalProductVariant.create({
      data: {
        externalProductId,
        productVariantId,
        externalId: normalized.externalId,
        sku: normalized.sku,
        barcode: normalized.barcode,
        price: normalized.price,
        currency: normalized.currency,
        stock: normalized.stock,
        status: ExternalEntityStatus.ACTIVE,
        lastSeenSyncId: syncRunId,
        sourceUpdatedAt: normalized.sourceUpdatedAt,
        lastSyncedAt: syncedAt,
      },
    });

    await this.refreshCanonicalVariantInventory(
      transaction,
      productVariantId,
      inventoryPolicy,
    );
  }

  private async resolveCanonicalVariant(
    transaction: Prisma.TransactionClient,
    productId: string,
    currentVariantId: string,
    normalized: NormalizedProductVariant,
  ) {
    const matchingVariantIds = await this.findMatchingVariants(
      transaction,
      productId,
      normalized,
    );
    const candidateIds = [
      ...new Set([currentVariantId, ...matchingVariantIds]),
    ];

    if (candidateIds.length === 1) return currentVariantId;

    const candidates = await transaction.productVariant.findMany({
      where: { id: { in: candidateIds }, productId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    const canonicalVariantId = candidates[0]?.id ?? currentVariantId;
    const duplicateVariantIds = candidates
      .slice(1)
      .map((variant) => variant.id);

    if (duplicateVariantIds.length > 0) {
      const duplicateKnowledgeFacts =
        await transaction.productKnowledgeFact.findMany({
          where: { variantId: { in: duplicateVariantIds } },
          select: {
            storeId: true,
            productId: true,
            scopeKey: true,
            factType: true,
            normalizedKey: true,
            label: true,
            value: true,
            status: true,
            verifiedByUserId: true,
            originatingQuestionId: true,
            verifiedAt: true,
            archivedAt: true,
          },
        });

      await transaction.externalProductVariant.updateMany({
        where: { productVariantId: { in: duplicateVariantIds } },
        data: { productVariantId: canonicalVariantId },
      });
      await transaction.productKnowledgeFact.deleteMany({
        where: { variantId: { in: duplicateVariantIds } },
      });
      if (duplicateKnowledgeFacts.length > 0) {
        await transaction.productKnowledgeFact.createMany({
          data: duplicateKnowledgeFacts.map((fact) => ({
            ...fact,
            variantId: canonicalVariantId,
          })),
          skipDuplicates: true,
        });
      }
      await transaction.productVariant.deleteMany({
        where: { id: { in: duplicateVariantIds } },
      });
    }

    return canonicalVariantId;
  }

  private async resolveMatchingVariant(
    transaction: Prisma.TransactionClient,
    productId: string,
    normalized: NormalizedProductVariant,
  ) {
    const matches = await this.findMatchingVariants(
      transaction,
      productId,
      normalized,
    );

    return matches[0] ?? null;
  }

  private async findMatchingVariants(
    transaction: Prisma.TransactionClient,
    productId: string,
    normalized: NormalizedProductVariant,
  ) {
    const barcode = normalized.barcode?.trim() || null;
    const baseWhere = {
      productId,
      status: { not: ProductVariantStatus.ARCHIVED },
    } satisfies Prisma.ProductVariantWhereInput;
    const findMatches = (identity: Prisma.ProductVariantWhereInput) =>
      transaction.productVariant.findMany({
        where: { ...baseWhere, ...identity },
        orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
        select: { id: true },
      });

    if (barcode) {
      const barcodeMatches = await findMatches({ barcode });
      if (barcodeMatches.length > 0) {
        return barcodeMatches.map((match) => match.id);
      }
    }

    const skuMatches = await findMatches({
      sku: normalized.sku,
      color: normalized.color ?? null,
      size: normalized.size ?? null,
    });
    if (skuMatches.length > 0) {
      return skuMatches.map((match) => match.id);
    }

    if (normalized.color || normalized.size) {
      const optionMatches = await findMatches({
        color: normalized.color ?? null,
        size: normalized.size ?? null,
      });
      if (optionMatches.length === 1) return [optionMatches[0].id];
    }

    return [];
  }

  private async refreshCanonicalVariantInventory(
    transaction: Prisma.TransactionClient,
    productVariantId: string,
    inventoryPolicy: InventoryPolicy,
  ) {
    const snapshots = await transaction.externalProductVariant.findMany({
      where: {
        productVariantId,
        status: ExternalEntityStatus.ACTIVE,
        externalProduct: {
          status: ExternalEntityStatus.ACTIVE,
          connection: { removedAt: null },
        },
      },
      orderBy: [{ lastSyncedAt: 'desc' }, { id: 'asc' }],
      select: {
        stock: true,
        sourceUpdatedAt: true,
        lastSyncedAt: true,
      },
    });

    if (snapshots.length === 0) {
      await transaction.productVariant.update({
        where: { id: productVariantId },
        data: { stock: 0, status: ProductVariantStatus.UNAVAILABLE },
      });
      return;
    }

    const stock =
      inventoryPolicy === InventoryPolicy.CHANNEL_SPECIFIC
        ? snapshots.reduce((total, snapshot) => total + snapshot.stock, 0)
        : Math.min(...snapshots.map((snapshot) => snapshot.stock));
    const sourceUpdatedAt = snapshots.reduce<Date | null>(
      (latest, snapshot) =>
        !snapshot.sourceUpdatedAt ||
        (latest && latest >= snapshot.sourceUpdatedAt)
          ? latest
          : snapshot.sourceUpdatedAt,
      null,
    );

    await transaction.productVariant.update({
      where: { id: productVariantId },
      data: {
        stock,
        status:
          stock > 0
            ? ProductVariantStatus.ACTIVE
            : ProductVariantStatus.OUT_OF_STOCK,
        sourceUpdatedAt,
        lastSyncedAt: snapshots[0].lastSyncedAt,
      },
    });
  }

  private async reconcileMissingVariants(
    transaction: Prisma.TransactionClient,
    externalProductId: string,
    syncRunId: string,
    inventoryPolicy: InventoryPolicy,
  ) {
    const staleVariants = await transaction.externalProductVariant.findMany({
      where: {
        externalProductId,
        status: ExternalEntityStatus.ACTIVE,
        OR: [{ lastSeenSyncId: null }, { lastSeenSyncId: { not: syncRunId } }],
      },
      select: { id: true, productVariantId: true },
    });

    if (staleVariants.length === 0) return;

    await transaction.externalProductVariant.updateMany({
      where: { id: { in: staleVariants.map((variant) => variant.id) } },
      data: { status: ExternalEntityStatus.UNAVAILABLE },
    });

    for (const productVariantId of new Set(
      staleVariants.map((variant) => variant.productVariantId),
    )) {
      await this.refreshCanonicalVariantInventory(
        transaction,
        productVariantId,
        inventoryPolicy,
      );
    }
  }

  private async updateInventoryVariant(
    connectionId: string,
    normalized: NormalizedInventoryVariant,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const connection = await transaction.channelConnection.findUniqueOrThrow({
        where: { id: connectionId },
        select: {
          store: { select: { inventoryPolicy: true } },
        },
      });
      const inventoryPolicy =
        connection.store.inventoryPolicy ?? InventoryPolicy.SHARED;
      const externalProduct = await transaction.externalProduct.findUnique({
        where: {
          connectionId_externalId: {
            connectionId,
            externalId: normalized.externalProductId,
          },
        },
        select: { id: true },
      });
      let externalVariant = externalProduct
        ? await transaction.externalProductVariant.findUnique({
            where: {
              externalProductId_externalId: {
                externalProductId: externalProduct.id,
                externalId: normalized.externalVariantId,
              },
            },
            select: {
              id: true,
              productVariantId: true,
              externalProductId: true,
              sourceUpdatedAt: true,
              sku: true,
              barcode: true,
              price: true,
              currency: true,
              stock: true,
              productVariant: {
                select: {
                  sku: true,
                  barcode: true,
                  price: true,
                  currency: true,
                  stock: true,
                },
              },
            },
          })
        : null;

      externalVariant ??= await transaction.externalProductVariant.findFirst({
        where: {
          externalProduct: { connectionId },
          OR: [
            { externalId: normalized.externalVariantId },
            ...(normalized.barcode ? [{ barcode: normalized.barcode }] : []),
            { sku: normalized.sku },
          ],
        },
        select: {
          id: true,
          productVariantId: true,
          externalProductId: true,
          sourceUpdatedAt: true,
          sku: true,
          barcode: true,
          price: true,
          currency: true,
          stock: true,
          productVariant: {
            select: {
              sku: true,
              barcode: true,
              price: true,
              currency: true,
              stock: true,
            },
          },
        },
      });

      if (!externalVariant) return null;

      if (
        normalized.sourceUpdatedAt &&
        externalVariant.sourceUpdatedAt &&
        normalized.sourceUpdatedAt < externalVariant.sourceUpdatedAt
      ) {
        return null;
      }

      const change: InventoryChange = isSameInventorySnapshot(
        externalVariant,
        normalized,
      )
        ? 'UNCHANGED'
        : 'UPDATED';
      const stockAlert = getStockAlert(externalVariant.stock, normalized.stock);

      const syncedAt = new Date();
      const variantMetadata = {
        sku: normalized.sku,
        barcode: normalized.barcode ?? null,
        ...(normalized.price === undefined ? {} : { price: normalized.price }),
        ...(normalized.currency ? { currency: normalized.currency } : {}),
        sourceUpdatedAt: normalized.sourceUpdatedAt,
        lastSyncedAt: syncedAt,
      };
      await transaction.productVariant.update({
        where: { id: externalVariant.productVariantId },
        data: variantMetadata,
      });
      await transaction.externalProductVariant.update({
        where: { id: externalVariant.id },
        data: {
          sku: normalized.sku,
          barcode: normalized.barcode ?? null,
          ...(normalized.price === undefined
            ? {}
            : { price: normalized.price }),
          ...(normalized.currency ? { currency: normalized.currency } : {}),
          ...(normalized.stock === undefined
            ? {}
            : { stock: normalized.stock }),
          status: ExternalEntityStatus.ACTIVE,
          sourceUpdatedAt: normalized.sourceUpdatedAt,
          lastSyncedAt: syncedAt,
        },
      });
      await this.refreshCanonicalVariantInventory(
        transaction,
        externalVariant.productVariantId,
        inventoryPolicy,
      );
      const parentExternalProduct = await transaction.externalProduct.update({
        where: { id: externalVariant.externalProductId },
        data: {
          status: ExternalEntityStatus.ACTIVE,
          lastSyncedAt: syncedAt,
        },
        select: { productId: true },
      });
      await transaction.product.update({
        where: { id: parentExternalProduct.productId },
        data: { status: ProductStatus.ACTIVE },
      });

      return { change, stockAlert } satisfies InventoryUpdateResult;
    });
  }

  private async notifyInventoryAlerts(
    data: ProductSyncJobData,
    counters: SyncCounters,
  ) {
    if (data.kind !== 'INVENTORY') return;

    if (counters.outOfStockAlerts > 0) {
      await this.notifications.createForStoreMembers({
        storeId: data.storeId,
        type: NotificationType.OUT_OF_STOCK,
        severity: NotificationSeverity.ERROR,
        title: 'Stoku tükenen varyantlar var',
        message: `${counters.outOfStockAlerts} varyantın stoğu son kontrolde tükendi. Stok takibi sayfasını inceleyin.`,
        actionUrl: '/dashboard/catalog/inventory?status=out_of_stock',
        entityType: 'CATALOG_SYNC_RUN',
        entityId: data.syncRunId,
        dedupeKey: `out-of-stock:${data.syncRunId}`,
      });
    }

    if (counters.lowStockAlerts > 0) {
      await this.notifications.createForStoreMembers({
        storeId: data.storeId,
        type: NotificationType.LOW_STOCK,
        severity: NotificationSeverity.WARNING,
        title: 'Kritik stok seviyesine düşen varyantlar var',
        message: `${counters.lowStockAlerts} varyantın stoğu 5 adet veya altına düştü. Stok takibi sayfasını inceleyin.`,
        actionUrl: '/dashboard/catalog/inventory?status=low_stock',
        entityType: 'CATALOG_SYNC_RUN',
        entityId: data.syncRunId,
        dedupeKey: `low-stock:${data.syncRunId}`,
      });
    }
  }

  private async reconcileMissingProducts(
    storeId: string,
    connectionId: string,
    syncRunId: string,
  ) {
    const staleExternalProductWhere = {
      connectionId,
      status: ExternalEntityStatus.ACTIVE,
      OR: [{ lastSeenSyncId: null }, { lastSeenSyncId: { not: syncRunId } }],
    } satisfies Prisma.ExternalProductWhereInput;
    const staleProductCount = await this.prisma.externalProduct.count({
      where: staleExternalProductWhere,
    });

    if (staleProductCount === 0) return 0;

    return this.prisma.$transaction(
      async (transaction) => {
        const store = await transaction.store.findUniqueOrThrow({
          where: { id: storeId },
          select: { inventoryPolicy: true },
        });
        await transaction.externalProductVariant.updateMany({
          where: { externalProduct: staleExternalProductWhere },
          data: { status: ExternalEntityStatus.UNAVAILABLE },
        });
        await transaction.externalProduct.updateMany({
          where: staleExternalProductWhere,
          data: { status: ExternalEntityStatus.ARCHIVED },
        });

        const productsWithoutActiveReferences = {
          status: { not: ProductStatus.ARCHIVED },
          externalProducts: {
            some: {
              connectionId,
              status: ExternalEntityStatus.ARCHIVED,
              OR: [
                { lastSeenSyncId: null },
                { lastSeenSyncId: { not: syncRunId } },
              ],
            },
            none: { status: ExternalEntityStatus.ACTIVE },
          },
        } satisfies Prisma.ProductWhereInput;
        const archivedProducts = await transaction.product.updateMany({
          where: productsWithoutActiveReferences,
          data: { status: ProductStatus.ARCHIVED },
        });

        await transaction.productVariant.updateMany({
          where: {
            status: { not: ProductVariantStatus.ARCHIVED },
            product: {
              status: ProductStatus.ARCHIVED,
              externalProducts: {
                some: {
                  connectionId,
                  status: ExternalEntityStatus.ARCHIVED,
                  OR: [
                    { lastSeenSyncId: null },
                    { lastSeenSyncId: { not: syncRunId } },
                  ],
                },
                none: { status: ExternalEntityStatus.ACTIVE },
              },
            },
          },
          data: { stock: 0, status: ProductVariantStatus.ARCHIVED },
        });

        await recalculateStoreVariantInventory(
          transaction,
          storeId,
          store.inventoryPolicy ?? InventoryPolicy.SHARED,
        );

        return archivedProducts.count;
      },
      { timeout: PRODUCT_SYNC_RECONCILIATION_TIMEOUT_MS },
    );
  }

  private async loadCheckpoint(data: ProductSyncJobData) {
    return this.prisma.catalogSyncRun.findFirst({
      where: { id: data.syncRunId, connectionId: data.connectionId },
      select: {
        status: true,
        progress: true,
        cursor: true,
        batchesProcessed: true,
        fetchCompleted: true,
        productsProcessed: true,
        variantsProcessed: true,
        productsArchived: true,
        productsCreated: true,
        productsUpdated: true,
        productsUnchanged: true,
        productsSkipped: true,
        variantsUpdated: true,
        variantsUnchanged: true,
        lowStockAlerts: true,
        outOfStockAlerts: true,
      },
    });
  }

  private async updateRunProgress(
    connectionId: string,
    syncRunId: string,
    data: {
      productsProcessed: number;
      variantsProcessed: number;
      productsCreated: number;
      productsUpdated: number;
      productsUnchanged: number;
      productsSkipped: number;
      variantsUpdated: number;
      variantsUnchanged: number;
      lowStockAlerts: number;
      outOfStockAlerts: number;
      batchesProcessed: number;
      fetchCompleted: boolean;
      stage?: 'FETCHING' | 'PERSISTING' | 'RECONCILING';
      progress?: number;
      cursor?: string;
    },
  ) {
    await this.prisma.$transaction([
      this.prisma.catalogSyncRun.update({
        where: { id: syncRunId },
        data: {
          productsProcessed: data.productsProcessed,
          variantsProcessed: data.variantsProcessed,
          productsCreated: data.productsCreated,
          productsUpdated: data.productsUpdated,
          productsUnchanged: data.productsUnchanged,
          productsSkipped: data.productsSkipped,
          variantsUpdated: data.variantsUpdated,
          variantsUnchanged: data.variantsUnchanged,
          lowStockAlerts: data.lowStockAlerts,
          outOfStockAlerts: data.outOfStockAlerts,
          batchesProcessed: data.batchesProcessed,
          fetchCompleted: data.fetchCompleted,
          stage: data.stage,
          progress: data.progress,
          cursor: data.cursor ?? null,
        },
      }),
      this.prisma.channelConnection.updateMany({
        where: { id: connectionId },
        data: { processingStartedAt: new Date() },
      }),
    ]);
  }

  private async completeSync(data: ProductSyncJobData, counters: SyncCounters) {
    const completedAt = new Date();
    const connectionData = {
      processingStartedAt: null,
      failureReason: null,
      ...(data.kind === 'FULL' || data.recoverErroredConnection
        ? {
            status: ChannelConnectionStatus.CONNECTED,
            ...(data.kind === 'FULL' ? { lastSyncAt: completedAt } : {}),
            lastInventorySyncAt: completedAt,
          }
        : { lastInventorySyncAt: completedAt }),
    };

    await this.prisma.$transaction(async (transaction) => {
      const store = await transaction.store.findUniqueOrThrow({
        where: { id: data.storeId },
        select: { workspaceId: true },
      });
      await transaction.catalogSyncRun.update({
        where: { id: data.syncRunId },
        data: {
          status: CatalogSyncStatus.COMPLETED,
          stage: 'COMPLETED',
          progress: 100,
          productsProcessed: counters.productsProcessed,
          variantsProcessed: counters.variantsProcessed,
          productsArchived: counters.productsArchived,
          productsCreated: counters.productsCreated,
          productsUpdated: counters.productsUpdated,
          productsUnchanged: counters.productsUnchanged,
          productsSkipped: counters.productsSkipped,
          variantsUpdated: counters.variantsUpdated,
          variantsUnchanged: counters.variantsUnchanged,
          lowStockAlerts: counters.lowStockAlerts,
          outOfStockAlerts: counters.outOfStockAlerts,
          fetchCompleted: true,
          cursor: null,
          completedAt,
        },
      });
      await transaction.channelConnection.update({
        where: { id: data.connectionId },
        data: connectionData,
      });
      await this.audit.record(
        {
          actorType: AuditActorType.SYSTEM,
          origin: AuditOrigin.WORKER,
          action: AuditAction.CATALOG_SYNC_COMPLETED,
          result: AuditResult.SUCCESS,
          workspaceId: store.workspaceId,
          storeId: data.storeId,
          targetType: 'CATALOG_SYNC_RUN',
          targetId: data.syncRunId,
          after: {
            kind: data.kind,
            productsProcessed: counters.productsProcessed,
            productsCreated: counters.productsCreated,
            productsUpdated: counters.productsUpdated,
            productsUnchanged: counters.productsUnchanged,
            productsSkipped: counters.productsSkipped,
            productsArchived: counters.productsArchived,
            variantsProcessed: counters.variantsProcessed,
          },
          metadata: { connectionId: data.connectionId },
        },
        transaction,
      );
    });
  }

  private async notifyProductLimit(
    data: ProductSyncJobData,
    counters: SyncCounters,
  ) {
    if (data.kind !== 'FULL' || counters.productsSkipped === 0) return;

    try {
      await this.notifications.createForStoreMembers({
        storeId: data.storeId,
        type: NotificationType.BILLING_PLAN_LIMIT,
        severity: NotificationSeverity.WARNING,
        title: 'Katalog plan kapasitesine ulaştı',
        message: `${counters.productsProcessed.toLocaleString('tr-TR')} ürün aktarıldı, ${counters.productsSkipped.toLocaleString('tr-TR')} ürün plan kapasitesi nedeniyle beklemede kaldı. Eksik ürünleri almak için planınızı yükseltebilirsiniz.`,
        actionUrl: '/billing',
        entityType: 'CATALOG_SYNC_RUN',
        entityId: data.syncRunId,
        dedupeKey: `billing-product-limit:${data.connectionId}`,
      });
    } catch (error) {
      this.logger.warn(
        `Product limit notification could not be created: ${errorMessage(error)}`,
      );
    }
  }

  private async reconcileQuestionProductLinks(
    data: ProductSyncJobData,
    updateProgress: (progress: number) => Promise<void>,
  ) {
    await this.prisma.catalogSyncRun.updateMany({
      where: { id: data.syncRunId, connectionId: data.connectionId },
      data: { stage: 'RECONCILING', progress: 90 },
    });
    await updateProgress(90);

    const recoveredQuestions =
      await this.productLinks.reconcilePendingQuestions(
        data.storeId,
        data.connectionId,
      );

    if (recoveredQuestions.length === 0) return;

    const knowledgeProfile = await this.prisma.storeKnowledgeProfile.findUnique(
      {
        where: { storeId: data.storeId },
        select: { automationMode: true },
      },
    );
    const automaticDraftsEnabled =
      knowledgeProfile?.automationMode === AiAutomationMode.SHADOW ||
      knowledgeProfile?.automationMode === AiAutomationMode.SAFE_AUTO;

    if (!automaticDraftsEnabled) return;

    for (const questionId of recoveredQuestions) {
      try {
        await this.questionDrafts.enqueue(data.storeId, questionId);
      } catch (error) {
        this.logger.warn(
          `Recovered question ${questionId} could not be queued for an AI draft: ${errorMessage(error)}`,
        );
      }
    }
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function fetchProgress(
  batchesProcessed: number,
  providerProgress: number | undefined,
) {
  const fetchShare =
    providerProgress !== undefined && Number.isFinite(providerProgress)
      ? Math.min(1, Math.max(0, providerProgress))
      : Math.min(1, batchesProcessed / PRODUCT_SYNC_EXPECTED_MAX_BATCHES);
  return Math.min(85, 10 + Math.ceil(fetchShare * 75));
}

function assertCursorAdvanced(
  requestedCursor: string | undefined,
  nextCursor: string | undefined,
) {
  if (nextCursor && nextCursor === requestedCursor) {
    throw new Error(
      'Sağlayıcı aynı sayfalama cursor değerini tekrar döndürdü; senkronizasyon güvenli biçimde durduruldu.',
    );
  }
}

function isSameProductSnapshot(
  existing: { rawPayload: Prisma.JsonValue; sourceUpdatedAt: Date | null },
  normalized: NormalizedProduct,
) {
  if (normalized.sourceUpdatedAt && existing.sourceUpdatedAt) {
    return (
      normalized.sourceUpdatedAt.getTime() ===
      existing.sourceUpdatedAt.getTime()
    );
  }

  return (
    JSON.stringify(existing.rawPayload) ===
    JSON.stringify(normalized.rawPayload)
  );
}

function isSameInventorySnapshot(
  existing: {
    sku: string;
    barcode: string | null;
    price: Prisma.Decimal;
    currency: string;
    stock: number;
  },
  normalized: NormalizedInventoryVariant,
) {
  return (
    existing.sku === normalized.sku &&
    existing.barcode === (normalized.barcode ?? null) &&
    (normalized.price === undefined ||
      existing.price.toString() === String(normalized.price)) &&
    (!normalized.currency || existing.currency === normalized.currency) &&
    (normalized.stock === undefined || existing.stock === normalized.stock)
  );
}

function getStockAlert(
  previousStock: number,
  currentStock: number | undefined,
): StockAlert | null {
  if (currentStock === undefined || currentStock === previousStock) return null;
  if (previousStock > 0 && currentStock === 0) return 'OUT_OF_STOCK';
  if (previousStock > 5 && currentStock > 0 && currentStock <= 5) {
    return 'LOW_STOCK';
  }

  return null;
}

function uniqueAttributes(attributes: Array<{ name: string; value: string }>) {
  return [
    ...new Map(
      attributes.map((attribute) => [
        `${attribute.name}\u0000${attribute.value}`,
        attribute,
      ]),
    ).values(),
  ];
}

function uniqueVariants(variants: NormalizedProductVariant[]) {
  return [
    ...new Map(
      variants.map((variant) => [variant.externalId, variant]),
    ).values(),
  ];
}

function getProductIdentityCandidates(
  product: NormalizedProduct,
): ProductIdentityCandidate[] {
  const candidates: ProductIdentityCandidate[] = [];
  const normalizedBrand = normalizeIdentityValue(product.brand ?? '');

  if (normalizedBrand) {
    const modelCodeSources = [
      product.title,
      product.externalId,
      ...product.attributes
        .filter((attribute) => isModelCodeAttribute(attribute.name))
        .map((attribute) => attribute.value),
    ];

    for (const code of modelCodeSources.flatMap(extractProductCodes)) {
      candidates.push({
        type: ProductIdentityType.MODEL_CODE,
        value: `${normalizedBrand}:${normalizeIdentityValue(code)}`,
      });
    }
  }

  for (const variant of product.variants) {
    const gtin = variant.barcode?.trim().replace(/\s+/g, '');

    if (gtin && /^\d{8,14}$/.test(gtin)) {
      candidates.push({ type: ProductIdentityType.GTIN, value: gtin });
    }
  }

  return [
    ...new Map(
      candidates.map((candidate) => [
        `${candidate.type}:${candidate.value}`,
        candidate,
      ]),
    ).values(),
  ];
}

function isModelCodeAttribute(name: string) {
  const normalizedName = normalizeSearchValue(name);

  return [
    'urun kodu',
    'urun model kodu',
    'model kodu',
    'product code',
    'model code',
  ].includes(normalizedName);
}

function extractProductCodes(value: string) {
  return (
    value
      .toUpperCase()
      .match(
        /\b(?=[A-Z0-9-]{6,32}\b)(?=[A-Z0-9-]*[A-Z])(?=[A-Z0-9-]*\d)[A-Z0-9]+(?:-[A-Z0-9]+)*\b/g,
      ) ?? []
  );
}

function normalizeIdentityValue(value: string) {
  return normalizeSearchValue(value)
    .replace(/[^a-z0-9]/g, '')
    .toUpperCase();
}

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ıİ]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .trim()
    .toLowerCase();
}
