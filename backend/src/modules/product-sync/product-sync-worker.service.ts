import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  CatalogSyncStatus,
  ChannelConnectionStatus,
  ExternalEntityStatus,
  ProductStatus,
  ProductVariantStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { CredentialsEncryptionService } from '../channels/credentials-encryption.service';
import type {
  NormalizedInventoryVariant,
  NormalizedProduct,
  NormalizedProductVariant,
} from '../channels/providers/catalog-connector';
import { ProviderRegistryService } from '../channels/providers/provider-registry.service';
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
};

@Injectable()
export class ProductSyncWorkerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderRegistryService,
    private readonly encryption: CredentialsEncryptionService,
  ) {}

  async run(
    data: ProductSyncJobData,
    updateProgress: (progress: number) => Promise<void>,
  ) {
    const connection = await this.prisma.channelConnection.findFirst({
      where: { id: data.connectionId, storeId: data.storeId },
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

    do {
      const batch = await this.providers.fetchProducts(
        connection.providerKey,
        { environment: connection.environment, credentials },
        cursor,
      );

      for (const product of batch.products) {
        await this.saveNormalizedProduct(
          data.storeId,
          connection.id,
          data.syncRunId,
          product,
        );
        productsProcessed += 1;
        variantsProcessed += uniqueVariants(product.variants).length;
      }

      cursor = batch.nextCursor;
      batchCount += 1;
      await this.updateRunProgress(data.syncRunId, {
        productsProcessed,
        variantsProcessed,
        cursor,
      });
      await updateProgress(Math.min(95, batchCount));
    } while (cursor && batchCount < PRODUCT_SYNC_MAX_BATCHES);

    if (cursor) {
      throw new Error('Katalog senkronizasyonu güvenli batch sınırını aştı.');
    }

    const productsArchived = await this.reconcileMissingProducts(
      connection.id,
      data.syncRunId,
    );

    return { productsProcessed, variantsProcessed, productsArchived };
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

    do {
      const batch = await this.providers.fetchInventory(
        connection.providerKey,
        { environment: connection.environment, credentials },
        cursor,
      );

      for (const variant of batch.variants) {
        const updated = await this.updateInventoryVariant(
          connection.id,
          variant,
        );
        if (updated) variantsProcessed += 1;
      }

      cursor = batch.nextCursor;
      batchCount += 1;
      await this.updateRunProgress(data.syncRunId, {
        productsProcessed: 0,
        variantsProcessed,
        cursor,
      });
      await updateProgress(Math.min(95, batchCount));
    } while (cursor && batchCount < PRODUCT_SYNC_MAX_BATCHES);

    if (cursor) {
      throw new Error('Envanter senkronizasyonu güvenli batch sınırını aştı.');
    }

    return {
      productsProcessed: 0,
      variantsProcessed,
      productsArchived: 0,
    };
  }

  private async saveNormalizedProduct(
    storeId: string,
    connectionId: string,
    syncRunId: string,
    normalized: NormalizedProduct,
  ) {
    await this.prisma.$transaction(async (transaction) => {
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
          select: { id: true, productId: true },
        });
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
        },
      });

      if (!externalVariant) return false;

      if (
        normalized.sourceUpdatedAt &&
        externalVariant.sourceUpdatedAt &&
        normalized.sourceUpdatedAt < externalVariant.sourceUpdatedAt
      ) {
        return false;
      }

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

      return true;
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
      cursor?: string;
    },
  ) {
    await this.prisma.catalogSyncRun.update({
      where: { id: syncRunId },
      data: {
        productsProcessed: data.productsProcessed,
        variantsProcessed: data.variantsProcessed,
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
          productsProcessed: counters.productsProcessed,
          variantsProcessed: counters.variantsProcessed,
          productsArchived: counters.productsArchived,
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
