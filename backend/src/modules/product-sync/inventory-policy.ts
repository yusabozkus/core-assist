import { Prisma } from '../../generated/prisma/client';
import {
  InventoryPolicy,
  ProductVariantStatus,
} from '../../generated/prisma/enums';

export async function recalculateStoreVariantInventory(
  transaction: Prisma.TransactionClient,
  storeId: string,
  inventoryPolicy: InventoryPolicy,
) {
  await transaction.productVariant.updateMany({
    where: {
      product: { storeId },
      status: { not: ProductVariantStatus.ARCHIVED },
      externalVariants: {
        none: { status: 'ACTIVE' },
      },
    },
    data: {
      stock: 0,
      status: ProductVariantStatus.UNAVAILABLE,
    },
  });

  if (inventoryPolicy === InventoryPolicy.CHANNEL_SPECIFIC) {
    await transaction.$executeRaw`
      UPDATE "product_variant" AS variant
      SET
        stock = inventory.stock,
        status = CASE
          WHEN inventory.stock > 0 THEN 'ACTIVE'::"ProductVariantStatus"
          ELSE 'OUT_OF_STOCK'::"ProductVariantStatus"
        END,
        "lastSyncedAt" = inventory."lastSyncedAt"
      FROM (
        SELECT
          external_variant."productVariantId",
          SUM(external_variant.stock)::int AS stock,
          MAX(external_variant."lastSyncedAt") AS "lastSyncedAt"
        FROM "external_product_variant" AS external_variant
        JOIN "external_product" AS external_product
          ON external_product.id = external_variant."externalProductId"
        JOIN "channel_connection" AS connection
          ON connection.id = external_product."connectionId"
        WHERE connection."storeId" = ${storeId}
          AND connection."removedAt" IS NULL
          AND external_product.status = 'ACTIVE'
          AND external_variant.status = 'ACTIVE'
        GROUP BY external_variant."productVariantId"
      ) AS inventory
      WHERE variant.id = inventory."productVariantId"
        AND variant.status <> 'ARCHIVED'
    `;
    return;
  }

  await transaction.$executeRaw`
    UPDATE "product_variant" AS variant
    SET
      stock = inventory.stock,
      status = CASE
        WHEN inventory.stock > 0 THEN 'ACTIVE'::"ProductVariantStatus"
        ELSE 'OUT_OF_STOCK'::"ProductVariantStatus"
      END,
      "lastSyncedAt" = inventory."lastSyncedAt"
    FROM (
      SELECT
        external_variant."productVariantId",
        MIN(external_variant.stock)::int AS stock,
        MAX(external_variant."lastSyncedAt") AS "lastSyncedAt"
      FROM "external_product_variant" AS external_variant
      JOIN "external_product" AS external_product
        ON external_product.id = external_variant."externalProductId"
      JOIN "channel_connection" AS connection
        ON connection.id = external_product."connectionId"
      WHERE connection."storeId" = ${storeId}
        AND connection."removedAt" IS NULL
        AND external_product.status = 'ACTIVE'
        AND external_variant.status = 'ACTIVE'
      GROUP BY external_variant."productVariantId"
    ) AS inventory
    WHERE variant.id = inventory."productVariantId"
      AND variant.status <> 'ARCHIVED'
  `;
}
