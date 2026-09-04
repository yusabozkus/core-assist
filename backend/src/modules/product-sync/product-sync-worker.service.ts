import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  CatalogSyncStatus,
  ChannelConnectionStatus,
  ExternalEntityStatus,
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
import { SizeGuideDispatcher } from '../size-guides/size-guide.types';
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
};

type ProductChange = 'CREATED' | 'UPDATED' | 'UNCHANGED';
type InventoryChange = 'UPDATED' | 'UNCHANGED';

@Injectable()
export class ProductSyncWorkerService {
  private readonly logger = new Logger(ProductSyncWorkerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderRegistryService,
    private readonly encryption: CredentialsEncryptionService,
    private readonly sizeGuides: SizeGuideDispatcher,
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

    await this.completeSync(data, counters);
    await updateProgress(100);
  }

  async markFinalFailure(data: ProductSyncJobData, error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Ürün senkronizasyonu başarısız.';
    const connectionData =
      data.kind === 'FULL'
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

    do {
      const batch = await this.providers.fetchInventory(
        connection.providerKey,
        { environment: connection.environment, credentials },
        cursor,
      );

      for (const variant of batch.variants) {
        const change = await this.updateInventoryVariant(
          connection.id,
          variant,
        );
        if (change) variantsProcessed += 1;
        if (change === 'UPDATED') variantsUpdated += 1;
        if (change === 'UNCHANGED') variantsUnchanged += 1;
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
        productId = existingExternalProduct.productId;
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
            externalUrl: normalized.externalUrl ?? null,
            rawPayload: normalized.rawPayload as Prisma.InputJsonValue,
            status: ExternalEntityStatus.ACTIVE,
            lastSeenSyncId: syncRunId,
            sourceUpdatedAt: normalized.sourceUpdatedAt,
            lastSyncedAt: syncedAt,
          },
        });
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

    const existingVariant = await transaction.productVariant.findUnique({
      where: { productId_sku: { productId, sku: normalized.sku } },
      select: { id: true },
    });

    if (existingVariant) {
      productVariantId = existingVariant.id;
      await transaction.productVariant.update({
        where: { id: productVariantId },
        data: fullVariantData,
      });
    } else {
      const productVariant = await transaction.productVariant.create({
        data: { productId, ...fullVariantData },
        select: { id: true },
      });
      productVariantId = productVariant.id;
    }

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

      return change;
    });
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
