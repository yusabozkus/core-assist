import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  ChannelConnectionStatus,
  ExternalEntityStatus,
  ProductStatus,
  ProductVariantStatus,
  StoreStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { BillingSubscriptionService } from '../billing/billing-subscription.service';
import { BILLING_SYNC_STOPPED_MESSAGE } from '../billing/billing-access.policy';
import { CredentialsEncryptionService } from '../channels/credentials-encryption.service';
import type { NormalizedInventoryVariant } from '../channels/providers/catalog-connector';
import { ProviderRegistryService } from '../channels/providers/provider-registry.service';
import {
  InventoryVerificationUnavailableError,
  type InventoryVerificationResult,
} from './inventory-verification.types';

type ExternalProductForVerification = {
  id: string;
  externalId: string;
  variants: Array<{
    id: string;
    externalId: string;
    sku: string;
    barcode: string | null;
    productVariantId: string;
    productVariant: {
      title: string | null;
      sku: string;
      color: string | null;
      size: string | null;
      price: unknown;
      currency: string;
    };
  }>;
};

@Injectable()
export class InventoryVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderRegistryService,
    private readonly encryption: CredentialsEncryptionService,
    private readonly billing: BillingSubscriptionService,
  ) {}

  verifyQuestionProduct(
    storeId: string,
    questionId: string,
  ): Promise<InventoryVerificationResult> {
    // No completed-result cache: dispatch must make a new provider request.
    return this.performVerification(storeId, questionId);
  }

  private async performVerification(
    storeId: string,
    questionId: string,
  ): Promise<InventoryVerificationResult> {
    await this.billing.assertStoreAccess(storeId, BILLING_SYNC_STOPPED_MESSAGE);
    const question = await this.prisma.productQuestion.findFirst({
      where: {
        id: questionId,
        storeId,
        store: { status: StoreStatus.ACTIVE },
      },
      select: {
        productId: true,
        connectionId: true,
        externalProductRecordId: true,
        connection: {
          select: {
            providerKey: true,
            environment: true,
            status: true,
            credentialsEncrypted: true,
          },
        },
      },
    });

    if (!question?.productId) {
      throw new InventoryVerificationUnavailableError(
        'Soru bir katalog ürünüyle eşleşmiyor.',
      );
    }
    if (
      question.connection.status !== ChannelConnectionStatus.CONNECTED ||
      !question.connection.credentialsEncrypted
    ) {
      throw new InventoryVerificationUnavailableError(
        'Pazaryeri bağlantısı canlı stok doğrulaması için kullanılamıyor.',
      );
    }

    const externalProducts = await this.prisma.externalProduct.findMany({
      where: {
        ...(question.externalProductRecordId
          ? { id: question.externalProductRecordId }
          : {}),
        connectionId: question.connectionId,
        productId: question.productId,
        status: ExternalEntityStatus.ACTIVE,
      },
      select: externalProductSelection,
      take: 2,
    });
    const externalProduct =
      externalProducts.length === 1 ? externalProducts[0] : null;

    if (!externalProduct || externalProduct.variants.length === 0) {
      throw new InventoryVerificationUnavailableError(
        'Ürünün pazaryeri varyant referansları bulunamadı.',
      );
    }

    await this.billing.assertStoreAccess(storeId, BILLING_SYNC_STOPPED_MESSAGE);
    try {
      const credentials = this.encryption.decrypt(
        question.connection.credentialsEncrypted,
      );
      const checkedAt = new Date();
      const inventory = await this.providers.fetchInventoryByReferences(
        question.connection.providerKey,
        {
          environment: question.connection.environment,
          credentials,
          signal: AbortSignal.timeout(15_000),
        },
        {
          externalProductId: externalProduct.externalId,
          variants: externalProduct.variants.map((variant) => ({
            externalVariantId: variant.externalId,
            sku: variant.sku,
            ...(variant.barcode ? { barcode: variant.barcode } : {}),
          })),
        },
      );

      return await this.persistVerifiedInventory(
        question.productId,
        externalProduct,
        inventory.variants,
        checkedAt,
      );
    } catch (error) {
      if (error instanceof InventoryVerificationUnavailableError) throw error;
      throw new InventoryVerificationUnavailableError(
        'Pazaryerinden güncel stok bilgisi alınamadı.',
        { cause: error },
      );
    }
  }

  private async persistVerifiedInventory(
    productId: string,
    externalProduct: ExternalProductForVerification,
    inventory: NormalizedInventoryVariant[],
    checkedAt: Date,
  ): Promise<InventoryVerificationResult> {
    const matchedInventory = externalProduct.variants.map((reference) => ({
      reference,
      inventory: matchReference(inventory, reference),
    }));
    const missingVariant = matchedInventory.find(
      (item) =>
        !Number.isSafeInteger(item.inventory?.stock) ||
        item.inventory!.stock! < 0,
    );

    if (missingVariant) {
      throw new InventoryVerificationUnavailableError(
        `Pazaryeri ${missingVariant.reference.sku} varyantının güncel stok bilgisini döndürmedi.`,
      );
    }

    const variants: InventoryVerificationResult['variants'] =
      matchedInventory.map(({ reference, inventory: normalized }) => ({
        ...reference.productVariant,
        price: normalized!.price ?? Number(reference.productVariant.price),
        currency: normalized!.currency ?? reference.productVariant.currency,
        stock: normalized!.stock!,
        status: normalized!.stock! > 0 ? 'ACTIVE' : 'OUT_OF_STOCK',
        lastSyncedAt: checkedAt.toISOString(),
      }));

    await this.prisma.$transaction(async (transaction) => {
      for (const item of matchedInventory) {
        const normalized = item.inventory!;
        const stock = normalized.stock!;

        const updated = await transaction.productVariant.updateMany({
          where: {
            id: item.reference.productVariantId,
            product: { store: { status: StoreStatus.ACTIVE } },
            AND: [
              {
                OR: [
                  { lastSyncedAt: null },
                  { lastSyncedAt: { lte: checkedAt } },
                ],
              },
              ...(normalized.sourceUpdatedAt
                ? [
                    {
                      OR: [
                        { sourceUpdatedAt: null },
                        {
                          sourceUpdatedAt: { lte: normalized.sourceUpdatedAt },
                        },
                      ],
                    },
                  ]
                : []),
            ],
          },
          data: {
            ...(normalized.price === undefined
              ? {}
              : { price: normalized.price }),
            ...(normalized.currency ? { currency: normalized.currency } : {}),
            stock,
            status:
              stock > 0
                ? ProductVariantStatus.ACTIVE
                : ProductVariantStatus.OUT_OF_STOCK,
            sourceUpdatedAt: normalized.sourceUpdatedAt,
            lastSyncedAt: checkedAt,
          },
        });
        if (updated.count !== 1) {
          throw new InventoryVerificationUnavailableError(
            'Stok kontrolü sırasında ürün bilgileri değişti; yeniden doğrulanmalı.',
          );
        }
        await transaction.externalProductVariant.update({
          where: { id: item.reference.id },
          data: {
            status: ExternalEntityStatus.ACTIVE,
            sourceUpdatedAt: normalized.sourceUpdatedAt,
            lastSyncedAt: checkedAt,
          },
        });
      }

      await transaction.externalProduct.update({
        where: { id: externalProduct.id },
        data: {
          status: ExternalEntityStatus.ACTIVE,
          lastSyncedAt: checkedAt,
        },
      });
      await transaction.product.update({
        where: { id: productId },
        data: { status: ProductStatus.ACTIVE },
      });
    });

    return {
      productId,
      checkedAt,
      snapshotHash: createHash('sha256')
        .update(
          JSON.stringify({
            externalProductId: externalProduct.id,
            availability: matchedInventory
              .map(({ reference, inventory: normalized }) => ({
                externalId: reference.externalId,
                sku: reference.productVariant.sku,
                color: reference.productVariant.color,
                size: reference.productVariant.size,
                available: normalized!.stock! > 0,
              }))
              .sort((a, b) => a.externalId.localeCompare(b.externalId)),
          }),
        )
        .digest('hex'),
      variants,
    };
  }
}

const externalProductSelection = {
  id: true,
  externalId: true,
  variants: {
    where: { status: ExternalEntityStatus.ACTIVE },
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      externalId: true,
      sku: true,
      barcode: true,
      productVariantId: true,
      productVariant: {
        select: {
          title: true,
          sku: true,
          color: true,
          size: true,
          price: true,
          currency: true,
        },
      },
    },
  },
} as const;

function matchReference(
  inventory: NormalizedInventoryVariant[],
  reference: ExternalProductForVerification['variants'][number],
) {
  for (const matches of [
    inventory.filter((v) => v.externalVariantId === reference.externalId),
    inventory.filter(
      (v) => reference.barcode && v.barcode === reference.barcode,
    ),
    inventory.filter((v) => v.sku === reference.sku),
  ]) {
    if (!matches.length) continue;
    const unique = new Map(
      matches.map((v) => [
        `${v.externalProductId}:${v.externalVariantId}:${v.stock}`,
        v,
      ]),
    );
    if (unique.size === 1) return [...unique.values()][0];
    throw new InventoryVerificationUnavailableError(
      'Pazaryeri varyant eşleşmesi belirsiz.',
    );
  }
  return undefined;
}
