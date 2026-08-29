import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  CatalogSyncStatus,
  ChannelConnectionStatus,
  ProductStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { CredentialsEncryptionService } from '../channels/credentials-encryption.service';
import type { NormalizedProduct } from '../channels/providers/catalog-connector';
import { ProviderRegistryService } from '../channels/providers/provider-registry.service';
import { PRODUCT_SYNC_MAX_BATCHES } from './product-sync.constants';
import type { ProductSyncJobData } from './product-sync.types';

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

    const credentials = this.encryption.decrypt(
      connection.credentialsEncrypted,
    );
    let cursor: string | undefined;
    let productsProcessed = 0;
    let batchCount = 0;

    do {
      const batch = await this.providers.fetchProducts(
        connection.providerKey,
        {
          environment: connection.environment,
          credentials,
        },
        cursor,
      );

      for (const product of batch.products) {
        await this.saveNormalizedProduct(data.storeId, connection.id, product);
        productsProcessed += 1;
      }

      cursor = batch.nextCursor;
      batchCount += 1;
      await updateProgress(Math.min(99, batchCount));
    } while (cursor && batchCount < PRODUCT_SYNC_MAX_BATCHES);

    if (cursor) {
      throw new Error('Katalog senkronizasyonu güvenli batch sınırını aştı.');
    }

    const completedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.catalogSyncRun.update({
        where: { id: data.syncRunId },
        data: {
          status: CatalogSyncStatus.COMPLETED,
          productsProcessed,
          cursor: null,
          completedAt,
        },
      }),
      this.prisma.channelConnection.update({
        where: { id: connection.id },
        data: {
          lastSyncAt: completedAt,
          processingStartedAt: null,
          failureReason: null,
        },
      }),
    ]);
    await updateProgress(100);
  }

  async markFinalFailure(data: ProductSyncJobData, error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Katalog senkronizasyonu başarısız.';

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
        where: {
          id: data.connectionId,
          status: ChannelConnectionStatus.CONNECTED,
        },
        data: {
          status: ChannelConnectionStatus.ERROR,
          processingStartedAt: null,
          failureReason: message,
        },
      }),
    ]);
  }

  private async saveNormalizedProduct(
    storeId: string,
    connectionId: string,
    normalized: NormalizedProduct,
  ) {
    await this.prisma.$transaction(async (transaction) => {
      const externalProduct = await transaction.externalProduct.findUnique({
        where: {
          connectionId_externalId: {
            connectionId,
            externalId: normalized.externalId,
          },
        },
        select: { id: true, productId: true },
      });
      const variants = normalized.variants.map((variant) => ({
        title: variant.title,
        sku: variant.sku,
        barcode: variant.barcode,
        color: variant.color,
        size: variant.size,
        price: variant.price,
        currency: variant.currency,
        stock: variant.stock,
      }));
      const images = normalized.images.map((url, position) => ({
        url,
        position,
      }));
      const productData = {
        title: normalized.title,
        description: normalized.description,
        brand: normalized.brand,
        category: normalized.category,
        status: ProductStatus.ACTIVE,
      };

      if (externalProduct) {
        await transaction.product.update({
          where: { id: externalProduct.productId },
          data: {
            ...productData,
            variants: { deleteMany: {}, create: variants },
            attributes: {
              deleteMany: {},
              create: normalized.attributes,
            },
            images: { deleteMany: {}, create: images },
          },
        });
        await transaction.externalProduct.update({
          where: { id: externalProduct.id },
          data: {
            externalUrl: normalized.externalUrl,
            rawPayload: normalized.rawPayload as Prisma.InputJsonValue,
            lastSyncedAt: new Date(),
          },
        });
        return;
      }

      const product = await transaction.product.create({
        data: {
          storeId,
          ...productData,
          variants: { create: variants },
          attributes: { create: normalized.attributes },
          images: { create: images },
        },
        select: { id: true },
      });
      await transaction.externalProduct.create({
        data: {
          connectionId,
          productId: product.id,
          externalId: normalized.externalId,
          externalUrl: normalized.externalUrl,
          rawPayload: normalized.rawPayload as Prisma.InputJsonValue,
        },
      });
    });
  }
}
