import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { StoreStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import type { CatalogProductsQueryDto } from './catalog-products-query.dto';

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
    const baseWhere = {
      storeId,
      status: 'ACTIVE',
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
          where: { product: baseWhere },
        }),
        this.prisma.productVariant.aggregate({
          where: { product: baseWhere, status: 'ACTIVE' },
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
      variants: product.variants.map((variant) => ({
        ...variant,
        price: Number(variant.price),
      })),
    };
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
