import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import {
  ChannelConnectionStatus,
  ProductVariantStatus,
  StoreStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import {
  type CatalogInventoryQueryDto,
  InventoryStockFilter,
} from './catalog-inventory-query.dto';
import type { CatalogProductsQueryDto } from './catalog-products-query.dto';
import {
  getInventoryFreshnessCutoff,
  getInventoryFreshnessMaxAgeMs,
  resolveInventoryFreshness,
} from './inventory-freshness';

const PRODUCT_DETAIL_SELECT = {
  id: true,
  title: true,
  description: true,
  brand: true,
  category: true,
  status: true,
  updatedAt: true,
  variants: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      title: true,
      sku: true,
      barcode: true,
      color: true,
      size: true,
      price: true,
      currency: true,
      stock: true,
      status: true,
      sourceUpdatedAt: true,
      lastSyncedAt: true,
      externalVariants: {
        select: {
          externalProduct: {
            select: {
              connection: { select: { providerKey: true } },
            },
          },
        },
      },
    },
  },
  attributes: {
    orderBy: { name: 'asc' },
    select: { id: true, name: true, value: true },
  },
  images: {
    orderBy: { position: 'asc' },
    select: { id: true, url: true, position: true },
  },
  sizeGuides: {
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      sourceUrl: true,
      status: true,
      normalizedText: true,
      structuredData: true,
      confidence: true,
      failureReason: true,
      analyzedAt: true,
    },
  },
  externalProducts: {
    select: {
      externalId: true,
      externalUrl: true,
      status: true,
      lastSyncedAt: true,
      connection: {
        select: { providerKey: true },
      },
    },
  },
} satisfies Prisma.ProductSelect;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async findProducts(
    storeId: string,
    userId: string,
    options: CatalogProductsQueryDto,
  ) {
    await this.assertStoreMembership(storeId, userId);

    const query = options.query?.trim();
    const provider = options.provider?.trim();
    const providerVariantWhere = {
      ...(provider
        ? {
            externalVariants: {
              some: {
                externalProduct: {
                  connection: { storeId, providerKey: provider },
                },
              },
            },
          }
        : {}),
    } satisfies Prisma.ProductVariantWhereInput;
    const baseWhere = {
      storeId,
      status: 'ACTIVE',
      ...(provider
        ? {
            externalProducts: {
              some: {
                connection: { storeId, providerKey: provider },
              },
            },
          }
        : {}),
    } satisfies Prisma.ProductWhereInput;
    const where: Prisma.ProductWhereInput = query
      ? {
          ...baseWhere,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { brand: { contains: query, mode: 'insensitive' } },
            { category: { contains: query, mode: 'insensitive' } },
            {
              attributes: {
                some: {
                  OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { value: { contains: query, mode: 'insensitive' } },
                  ],
                },
              },
            },
            {
              variants: {
                some: {
                  ...providerVariantWhere,
                  OR: [
                    { sku: { contains: query, mode: 'insensitive' } },
                    { barcode: { contains: query, mode: 'insensitive' } },
                    { color: { contains: query, mode: 'insensitive' } },
                    { size: { contains: query, mode: 'insensitive' } },
                  ],
                },
              },
            },
          ],
        }
      : baseWhere;

    const [products, filteredTotal, productCount, variantCount, stock] =
      await Promise.all([
        this.prisma.product.findMany({
          where,
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          take: options.limit + 1,
          ...(options.cursor
            ? { cursor: { id: options.cursor }, skip: 1 }
            : {}),
          select: {
            id: true,
            title: true,
            brand: true,
            category: true,
            status: true,
            updatedAt: true,
            images: {
              orderBy: { position: 'asc' },
              take: 1,
              select: { url: true },
            },
            variants: {
              where: providerVariantWhere,
              select: {
                price: true,
                currency: true,
                stock: true,
                status: true,
              },
            },
            externalProducts: {
              select: {
                status: true,
                connection: { select: { providerKey: true } },
              },
            },
          },
        }),
        this.prisma.product.count({ where }),
        this.prisma.product.count({ where: baseWhere }),
        this.prisma.productVariant.count({
          where: { product: baseWhere, ...providerVariantWhere },
        }),
        this.prisma.productVariant.aggregate({
          where: {
            product: baseWhere,
            status: 'ACTIVE',
            ...providerVariantWhere,
          },
          _sum: { stock: true },
        }),
      ]);

    const hasNextPage = products.length > options.limit;
    const visibleProducts = hasNextPage
      ? products.slice(0, options.limit)
      : products;

    return {
      items: visibleProducts.map((product) => {
        const prices = product.variants.map((variant) => Number(variant.price));
        const activeStock = product.variants.reduce(
          (total, variant) =>
            variant.status === 'ACTIVE' ? total + variant.stock : total,
          0,
        );

        return {
          id: product.id,
          title: product.title,
          brand: product.brand,
          category: product.category,
          status: product.status,
          updatedAt: product.updatedAt,
          imageUrl: product.images[0]?.url ?? null,
          variantCount: product.variants.length,
          totalStock: activeStock,
          minimumPrice: prices.length > 0 ? Math.min(...prices) : null,
          maximumPrice: prices.length > 0 ? Math.max(...prices) : null,
          currency: product.variants[0]?.currency ?? 'TRY',
          providers: product.externalProducts.map((externalProduct) => ({
            providerKey: externalProduct.connection.providerKey,
            status: externalProduct.status,
          })),
        };
      }),
      nextCursor: hasNextPage ? (visibleProducts.at(-1)?.id ?? null) : null,
      total: filteredTotal,
      summary: {
        products: productCount,
        variants: variantCount,
        totalStock: stock._sum.stock ?? 0,
      },
    };
  }

  async findProduct(storeId: string, productId: string, userId: string) {
    await this.assertStoreMembership(storeId, userId);

    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId, status: 'ACTIVE' },
      select: PRODUCT_DETAIL_SELECT,
    });

    if (!product) {
      throw new NotFoundException('Ürün bulunamadı veya erişiminiz yok.');
    }

    return {
      ...product,
      variants: product.variants.map(({ externalVariants, ...variant }) => ({
        ...variant,
        price: Number(variant.price),
        providers: [
          ...new Set(
            externalVariants.map(
              (externalVariant) =>
                externalVariant.externalProduct.connection.providerKey,
            ),
          ),
        ],
      })),
    };
  }

  async findInventory(
    storeId: string,
    userId: string,
    options: CatalogInventoryQueryDto,
  ) {
    await this.assertStoreMembership(storeId, userId);

    const query = options.query?.trim();
    const provider = options.provider?.trim();
    const freshnessCutoff = getInventoryFreshnessCutoff();
    const baseWhere = {
      product: { storeId, status: 'ACTIVE' },
      status: { not: ProductVariantStatus.ARCHIVED },
    } satisfies Prisma.ProductVariantWhereInput;
    const filters: Prisma.ProductVariantWhereInput[] = [baseWhere];

    if (query) {
      filters.push({
        OR: [
          { sku: { contains: query, mode: 'insensitive' } },
          { barcode: { contains: query, mode: 'insensitive' } },
          { title: { contains: query, mode: 'insensitive' } },
          { color: { contains: query, mode: 'insensitive' } },
          { size: { contains: query, mode: 'insensitive' } },
          { product: { title: { contains: query, mode: 'insensitive' } } },
          { product: { brand: { contains: query, mode: 'insensitive' } } },
          { product: { category: { contains: query, mode: 'insensitive' } } },
        ],
      });
    }

    if (provider) {
      filters.push({
        externalVariants: {
          some: {
            externalProduct: {
              connection: { providerKey: provider },
            },
          },
        },
      });
    }

    const stockFilter = this.getInventoryStockFilter(
      options.status,
      options.lowStockThreshold,
      freshnessCutoff,
    );
    if (stockFilter) filters.push(stockFilter);

    const where: Prisma.ProductVariantWhereInput = { AND: filters };
    const healthyWhere: Prisma.ProductVariantWhereInput = {
      ...baseWhere,
      status: ProductVariantStatus.ACTIVE,
      stock: { gt: options.lowStockThreshold },
    };
    const lowStockWhere: Prisma.ProductVariantWhereInput = {
      ...baseWhere,
      status: ProductVariantStatus.ACTIVE,
      stock: { gt: 0, lte: options.lowStockThreshold },
    };
    const outOfStockWhere: Prisma.ProductVariantWhereInput = {
      AND: [
        baseWhere,
        {
          OR: [
            {
              stock: { lte: 0 },
              status: ProductVariantStatus.ACTIVE,
            },
            { status: ProductVariantStatus.OUT_OF_STOCK },
          ],
        },
      ],
    };

    const productWhere = {
      storeId,
      status: 'ACTIVE',
      variants: { some: where },
    } satisfies Prisma.ProductWhereInput;

    const [
      products,
      filteredProductTotal,
      filteredVariantTotal,
      variantCount,
      healthyVariants,
      lowStockVariants,
      outOfStockVariants,
      unavailableVariants,
      staleVariants,
      stock,
      freshness,
      providerConnections,
    ] = await Promise.all([
      this.prisma.product.findMany({
        where: productWhere,
        orderBy: [{ title: 'asc' }, { id: 'asc' }],
        take: options.limit + 1,
        ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          title: true,
          brand: true,
          category: true,
          images: {
            orderBy: { position: 'asc' },
            take: 1,
            select: { url: true },
          },
          variants: {
            where,
            orderBy: [{ stock: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              title: true,
              sku: true,
              barcode: true,
              color: true,
              size: true,
              price: true,
              currency: true,
              stock: true,
              status: true,
              sourceUpdatedAt: true,
              lastSyncedAt: true,
              externalVariants: {
                select: {
                  externalProduct: {
                    select: {
                      connection: { select: { providerKey: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.product.count({ where: productWhere }),
      this.prisma.productVariant.count({ where }),
      this.prisma.productVariant.count({ where: baseWhere }),
      this.prisma.productVariant.count({ where: healthyWhere }),
      this.prisma.productVariant.count({ where: lowStockWhere }),
      this.prisma.productVariant.count({ where: outOfStockWhere }),
      this.prisma.productVariant.count({
        where: { ...baseWhere, status: ProductVariantStatus.UNAVAILABLE },
      }),
      this.prisma.productVariant.count({
        where: {
          AND: [
            baseWhere,
            {
              OR: [
                { lastSyncedAt: null },
                { lastSyncedAt: { lt: freshnessCutoff } },
              ],
            },
          ],
        },
      }),
      this.prisma.productVariant.aggregate({
        where: { ...baseWhere, status: ProductVariantStatus.ACTIVE },
        _sum: { stock: true },
      }),
      this.prisma.productVariant.aggregate({
        where: baseWhere,
        _max: { lastSyncedAt: true },
      }),
      this.prisma.channelConnection.findMany({
        where: {
          storeId,
          type: 'COMMERCE',
          status: ChannelConnectionStatus.CONNECTED,
        },
        distinct: ['providerKey'],
        orderBy: { providerKey: 'asc' },
        select: { providerKey: true },
      }),
    ]);

    const hasNextPage = products.length > options.limit;
    const visibleProducts = hasNextPage
      ? products.slice(0, options.limit)
      : products;

    return {
      items: visibleProducts.flatMap((product) =>
        product.variants.map((variant) => ({
          id: variant.id,
          productId: product.id,
          productTitle: product.title,
          productBrand: product.brand,
          productCategory: product.category,
          imageUrl: product.images[0]?.url ?? null,
          title: variant.title,
          sku: variant.sku,
          barcode: variant.barcode,
          color: variant.color,
          size: variant.size,
          price: Number(variant.price),
          currency: variant.currency,
          stock: variant.stock,
          status: variant.status,
          sourceUpdatedAt: variant.sourceUpdatedAt,
          lastSyncedAt: variant.lastSyncedAt,
          freshness: resolveInventoryFreshness(
            variant.lastSyncedAt,
            freshnessCutoff,
          ),
          providers: [
            ...new Set(
              variant.externalVariants.map(
                (externalVariant) =>
                  externalVariant.externalProduct.connection.providerKey,
              ),
            ),
          ],
        })),
      ),
      nextCursor: hasNextPage ? (visibleProducts.at(-1)?.id ?? null) : null,
      total: filteredProductTotal,
      variantTotal: filteredVariantTotal,
      lowStockThreshold: options.lowStockThreshold,
      freshnessMaxAgeMs: getInventoryFreshnessMaxAgeMs(),
      providers: providerConnections.map(
        (connection) => connection.providerKey,
      ),
      summary: {
        variants: variantCount,
        healthy: healthyVariants,
        lowStock: lowStockVariants,
        outOfStock: outOfStockVariants,
        unavailable: unavailableVariants,
        stale: staleVariants,
        totalStock: stock._sum.stock ?? 0,
        lastSyncedAt: freshness._max.lastSyncedAt,
      },
    };
  }

  private getInventoryStockFilter(
    status: InventoryStockFilter,
    lowStockThreshold: number,
    freshnessCutoff: Date,
  ): Prisma.ProductVariantWhereInput | null {
    switch (status) {
      case InventoryStockFilter.IN_STOCK:
        return {
          stock: { gt: 0 },
          status: ProductVariantStatus.ACTIVE,
        };
      case InventoryStockFilter.LOW_STOCK:
        return {
          stock: { gt: 0, lte: lowStockThreshold },
          status: ProductVariantStatus.ACTIVE,
        };
      case InventoryStockFilter.OUT_OF_STOCK:
        return {
          OR: [
            {
              stock: { lte: 0 },
              status: ProductVariantStatus.ACTIVE,
            },
            { status: ProductVariantStatus.OUT_OF_STOCK },
          ],
        };
      case InventoryStockFilter.UNAVAILABLE:
        return { status: ProductVariantStatus.UNAVAILABLE };
      case InventoryStockFilter.STALE:
        return {
          OR: [
            { lastSyncedAt: null },
            { lastSyncedAt: { lt: freshnessCutoff } },
          ],
        };
      case InventoryStockFilter.ALL:
        return null;
    }
  }

  private async assertStoreMembership(storeId: string, userId: string) {
    const membership = await this.prisma.storeMember.findFirst({
      where: {
        storeId,
        userId,
        store: { status: StoreStatus.ACTIVE },
      },
      select: { id: true },
    });

    if (!membership) {
      throw new NotFoundException(
        'Mağaza bulunamadı, arşivlenmiş veya erişiminiz yok.',
      );
    }
  }
}
