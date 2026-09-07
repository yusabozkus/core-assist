import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  CatalogSyncStatus,
  AiAutomationMode,
  ChannelConnectionStatus,
  ExternalEntityStatus,
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
import type { QuestionDraftDispatcher } from '../questions/question-draft.types';
import { PRODUCT_SYNC_MAX_BATCHES } from './product-sync.constants';
import type { ProductSyncJobData } from './product-sync.types';

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
    @Inject(QUESTION_DRAFT_DISPATCHER)
    private readonly questionDrafts: QuestionDraftDispatcher,
  ) {}

  async run(
    data: ProductSyncJobData,
    updateProgress: (progress: number) => Promise<void>,
  ) {
    await this.prisma.catalogSyncRun.updateMany({
      where: { id: data.syncRunId, connectionId: data.connectionId },
      data: { stage: 'FETCHING', progress: 10 },
    });
    await updateProgress(10);

    const connection = await this.prisma.channelConnection.findFirst({
      where: {
        id: data.connectionId,
        storeId: data.storeId,
        status: ChannelConnectionStatus.CONNECTED,
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
    const counters =
      data.kind === 'INVENTORY'
        ? await this.syncInventory(
            data,
            syncConnection,
            credentials,
            updateProgress,
          )
        : await this.syncFullCatalog(
            data,
            syncConnection,
            credentials,
            updateProgress,
          );

    if (data.kind === 'FULL') {
      await this.reconcileQuestionProductLinks(data, updateProgress);
    }

    await this.completeSync(data, counters);
    await this.notifyInventoryAlerts(data, counters);
    await updateProgress(100);
  }

  async markFinalFailure(data: ProductSyncJobData, error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Ürün senkronizasyonu başarısız.';
    const authenticationError = isProviderAuthenticationError(error);
    const connectionData =
      data.kind === 'FULL' || authenticationError
        ? {
            status: ChannelConnectionStatus.ERROR,
            processingStartedAt: null,
            failureReason: message,
          }
        : {
            processingStartedAt: null,
            failureReason: message,
          };

    await this.prisma.$transaction([
      this.prisma.catalogSyncRun.updateMany({
        where: { id: data.syncRunId },
        data: {
          status: CatalogSyncStatus.FAILED,
          stage: 'FAILED',
          progress: 100,
          errorMessage: message,
          completedAt: new Date(),
        },
      }),
      this.prisma.channelConnection.updateMany({
        where: { id: data.connectionId },
        data: connectionData,
      }),
    ]);

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
    updateProgress: (progress: number) => Promise<void>,
  ): Promise<SyncCounters> {
    let cursor: string | undefined;
    let productsProcessed = 0;
    let variantsProcessed = 0;
    let batchCount = 0;
    let productsCreated = 0;
    let productsUpdated = 0;
    let productsUnchanged = 0;

    do {
      const batch = await this.providers.fetchProducts(
        connection.providerKey,
        { environment: connection.environment, credentials },
        cursor,
      );

      for (const product of batch.products) {
        const change = await this.saveNormalizedProduct(
          data.storeId,
          connection.id,
          data.syncRunId,
          product,
        );
        if (change === 'CREATED') productsCreated += 1;
        if (change === 'UPDATED') productsUpdated += 1;
        if (change === 'UNCHANGED') productsUnchanged += 1;
        productsProcessed += 1;
        variantsProcessed += uniqueVariants(product.variants).length;
      }

      cursor = batch.nextCursor;
      batchCount += 1;
      await this.updateRunProgress(data.syncRunId, {
        productsProcessed,
        variantsProcessed,
        productsCreated,
        productsUpdated,
        productsUnchanged,
        stage: 'PERSISTING',
        progress: Math.min(80, 20 + batchCount * 5),
        cursor,
      });
      await updateProgress(Math.min(80, 20 + batchCount * 5));
    } while (cursor && batchCount < PRODUCT_SYNC_MAX_BATCHES);

    if (cursor) {
      throw new Error('Katalog senkronizasyonu güvenli batch sınırını aştı.');
    }

    await this.prisma.catalogSyncRun.update({
      where: { id: data.syncRunId },
      data: { stage: 'RECONCILING', progress: 90 },
    });
    await updateProgress(90);

    const productsArchived = await this.reconcileMissingProducts(
      connection.id,
      data.syncRunId,
    );

    return {
      productsProcessed,
      variantsProcessed,
      productsArchived,
      productsCreated,
      productsUpdated,
      productsUnchanged,
      variantsUpdated: 0,
      variantsUnchanged: 0,
      lowStockAlerts: 0,
      outOfStockAlerts: 0,
    };
  }

  private async syncInventory(
    data: ProductSyncJobData,
    connection: SyncConnection,
    credentials: Record<string, string>,
    updateProgress: (progress: number) => Promise<void>,
  ): Promise<SyncCounters> {
    let cursor: string | undefined;
    let variantsProcessed = 0;
    let batchCount = 0;
    let variantsUpdated = 0;
    let variantsUnchanged = 0;
    let lowStockAlerts = 0;
    let outOfStockAlerts = 0;

    do {
      const batch = await this.providers.fetchInventory(
        connection.providerKey,
        { environment: connection.environment, credentials },
        cursor,
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
      batchCount += 1;
      await this.updateRunProgress(data.syncRunId, {
        productsProcessed: 0,
        variantsProcessed,
        variantsUpdated,
        variantsUnchanged,
        stage: 'PERSISTING',
        progress: Math.min(90, 20 + batchCount * 5),
        cursor,
      });
      await updateProgress(Math.min(90, 20 + batchCount * 5));
    } while (cursor && batchCount < PRODUCT_SYNC_MAX_BATCHES);

    if (cursor) {
      throw new Error('Envanter senkronizasyonu güvenli batch sınırını aştı.');
    }

    return {
      productsProcessed: 0,
      variantsProcessed,
      productsArchived: 0,
      productsCreated: 0,
      productsUpdated: 0,
      productsUnchanged: 0,
      variantsUpdated,
      variantsUnchanged,
      lowStockAlerts,
      outOfStockAlerts,
    };
  }

  private async saveNormalizedProduct(
    storeId: string,
    connectionId: string,
    syncRunId: string,
    normalized: NormalizedProduct,
  ) {
    const saved = await this.prisma.$transaction(async (transaction) => {
      const syncedAt = new Date();
      const attributes = uniqueAttributes(normalized.attributes);
      const images = [...new Set(normalized.images.filter(Boolean))];
      const variants = uniqueVariants(normalized.variants);
      const identityCandidates = getProductIdentityCandidates(normalized);
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
        );
      }

      await this.reconcileMissingVariants(
        transaction,
        externalProductId,
        syncRunId,
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

  private async resolveCanonicalProduct(
    transaction: Prisma.TransactionClient,
    storeId: string,
    currentProductId: string | undefined,
    identities: ProductIdentityCandidate[],
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
    const candidateIds = [
      ...new Set([
        ...(currentProductId ? [currentProductId] : []),
        ...identityMatches.map((identity) => identity.productId),
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

  private async mergeProducts(
    transaction: Prisma.TransactionClient,
    canonicalProductId: string,
    duplicateProductIds: string[],
  ) {
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
      productVariantId = externalVariant.productVariantId;
      await transaction.productVariant.update({
        where: { id: productVariantId },
        data: variantUpdateData,
      });
      await transaction.externalProductVariant.update({
        where: { id: externalVariant.id },
        data: {
          sku: normalized.sku,
          barcode: normalized.barcode ?? null,
          status: ExternalEntityStatus.ACTIVE,
          lastSeenSyncId: syncRunId,
          sourceUpdatedAt: normalized.sourceUpdatedAt,
          lastSyncedAt: syncedAt,
        },
      });
      return;
    }

    const productVariant = await transaction.productVariant.create({
      data: { productId, ...fullVariantData },
      select: { id: true },
    });
    productVariantId = productVariant.id;

    await transaction.externalProductVariant.create({
      data: {
        externalProductId,
        productVariantId,
        externalId: normalized.externalId,
        sku: normalized.sku,
        barcode: normalized.barcode,
        status: ExternalEntityStatus.ACTIVE,
        lastSeenSyncId: syncRunId,
        sourceUpdatedAt: normalized.sourceUpdatedAt,
        lastSyncedAt: syncedAt,
      },
    });
  }

  private async reconcileMissingVariants(
    transaction: Prisma.TransactionClient,
    externalProductId: string,
    syncRunId: string,
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
      const activeReferences = await transaction.externalProductVariant.count({
        where: {
          productVariantId,
          status: ExternalEntityStatus.ACTIVE,
        },
      });

      if (activeReferences === 0) {
        await transaction.productVariant.update({
          where: { id: productVariantId },
          data: { stock: 0, status: ProductVariantStatus.UNAVAILABLE },
        });
      }
    }
  }

  private async updateInventoryVariant(
    connectionId: string,
    normalized: NormalizedInventoryVariant,
  ) {
    return this.prisma.$transaction(async (transaction) => {
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
        externalVariant.productVariant,
        normalized,
      )
        ? 'UNCHANGED'
        : 'UPDATED';
      const stockAlert = getStockAlert(
        externalVariant.productVariant.stock,
        normalized.stock,
      );

      const syncedAt = new Date();
      const inventoryData = {
        sku: normalized.sku,
        barcode: normalized.barcode ?? null,
        ...(normalized.price === undefined ? {} : { price: normalized.price }),
        ...(normalized.currency ? { currency: normalized.currency } : {}),
        ...(normalized.stock === undefined
          ? {}
          : {
              stock: normalized.stock,
              status:
                normalized.stock > 0
                  ? ProductVariantStatus.ACTIVE
                  : ProductVariantStatus.OUT_OF_STOCK,
            }),
        sourceUpdatedAt: normalized.sourceUpdatedAt,
        lastSyncedAt: syncedAt,
      };
      await transaction.productVariant.update({
        where: { id: externalVariant.productVariantId },
        data: inventoryData,
      });
      await transaction.externalProductVariant.update({
        where: { id: externalVariant.id },
        data: {
          sku: normalized.sku,
          barcode: normalized.barcode ?? null,
          status: ExternalEntityStatus.ACTIVE,
          sourceUpdatedAt: normalized.sourceUpdatedAt,
          lastSyncedAt: syncedAt,
        },
      });
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
    connectionId: string,
    syncRunId: string,
  ) {
    const staleProducts = await this.prisma.externalProduct.findMany({
      where: {
        connectionId,
        status: ExternalEntityStatus.ACTIVE,
        OR: [{ lastSeenSyncId: null }, { lastSeenSyncId: { not: syncRunId } }],
      },
      select: { id: true, productId: true },
    });

    if (staleProducts.length === 0) return 0;

    await this.prisma.$transaction(async (transaction) => {
      const externalProductIds = staleProducts.map((product) => product.id);
      await transaction.externalProduct.updateMany({
        where: { id: { in: externalProductIds } },
        data: { status: ExternalEntityStatus.ARCHIVED },
      });
      await transaction.externalProductVariant.updateMany({
        where: { externalProductId: { in: externalProductIds } },
        data: { status: ExternalEntityStatus.UNAVAILABLE },
      });

      for (const productId of new Set(
        staleProducts.map((product) => product.productId),
      )) {
        const activeReferences = await transaction.externalProduct.count({
          where: { productId, status: ExternalEntityStatus.ACTIVE },
        });

        if (activeReferences === 0) {
          await transaction.product.update({
            where: { id: productId },
            data: { status: ProductStatus.ARCHIVED },
          });
          await transaction.productVariant.updateMany({
            where: { productId },
            data: { stock: 0, status: ProductVariantStatus.ARCHIVED },
          });
        }
      }
    });

    return new Set(staleProducts.map((product) => product.productId)).size;
  }

  private async updateRunProgress(
    syncRunId: string,
    data: {
      productsProcessed: number;
      variantsProcessed: number;
      productsCreated?: number;
      productsUpdated?: number;
      productsUnchanged?: number;
      variantsUpdated?: number;
      variantsUnchanged?: number;
      stage?: 'FETCHING' | 'PERSISTING' | 'RECONCILING';
      progress?: number;
      cursor?: string;
    },
  ) {
    await this.prisma.catalogSyncRun.update({
      where: { id: syncRunId },
      data: {
        productsProcessed: data.productsProcessed,
        variantsProcessed: data.variantsProcessed,
        productsCreated: data.productsCreated,
        productsUpdated: data.productsUpdated,
        productsUnchanged: data.productsUnchanged,
        variantsUpdated: data.variantsUpdated,
        variantsUnchanged: data.variantsUnchanged,
        stage: data.stage,
        progress: data.progress,
        cursor: data.cursor ?? null,
      },
    });
  }

  private async completeSync(data: ProductSyncJobData, counters: SyncCounters) {
    const completedAt = new Date();
    const connectionData = {
      processingStartedAt: null,
      failureReason: null,
      ...(data.kind === 'FULL'
        ? {
            status: ChannelConnectionStatus.CONNECTED,
            lastSyncAt: completedAt,
            lastInventorySyncAt: completedAt,
          }
        : { lastInventorySyncAt: completedAt }),
    };

    await this.prisma.$transaction([
      this.prisma.catalogSyncRun.update({
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
          variantsUpdated: counters.variantsUpdated,
          variantsUnchanged: counters.variantsUnchanged,
          cursor: null,
          completedAt,
        },
      }),
      this.prisma.channelConnection.update({
        where: { id: data.connectionId },
        data: connectionData,
      }),
    ]);
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
