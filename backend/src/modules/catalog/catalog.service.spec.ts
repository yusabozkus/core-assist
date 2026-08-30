import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  const findMembership = jest.fn();
  const findProducts = jest.fn();
  const countProducts = jest.fn();
  const findProduct = jest.fn();
  const countVariants = jest.fn();
  const aggregateStock = jest.fn();
  const prisma = {
    storeMember: { findUnique: findMembership },
    product: {
      findMany: findProducts,
      findFirst: findProduct,
      count: countProducts,
    },
    productVariant: {
      count: countVariants,
      aggregate: aggregateStock,
    },
  } as unknown as PrismaService;
  const service = new CatalogService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    findMembership.mockResolvedValue({ id: 'member-1' });
    countProducts.mockResolvedValueOnce(12).mockResolvedValueOnce(12);
    countVariants.mockResolvedValue(24);
    aggregateStock.mockResolvedValue({ _sum: { stock: 47 } });
  });

  it('returns a compact cursor-paginated catalog page', async () => {
    findProducts.mockResolvedValue([
      createListProduct('product-1'),
      createListProduct('product-2'),
      createListProduct('product-3'),
    ]);

    const page = await service.findProducts('store-1', 'user-1', {
      limit: 2,
    });

    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe('product-2');
    expect(page.total).toBe(12);
    expect(page.summary).toEqual({
      products: 12,
      variants: 24,
      totalStock: 47,
    });
    expect(page.items[0]).toEqual(
      expect.objectContaining({
        variantCount: 2,
        totalStock: 5,
        minimumPrice: 100,
        maximumPrice: 120,
      }),
    );
    expect(findProducts).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
  });

  it('loads the full product only from the requested store', async () => {
    findProduct.mockResolvedValue({
      id: 'product-1',
      variants: [{ id: 'variant-1', price: 100 }],
    });

    const product = await service.findProduct('store-1', 'product-1', 'user-1');

    expect(product).toEqual({
      id: 'product-1',
      variants: [{ id: 'variant-1', price: 100 }],
    });
    expect(findProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'product-1', storeId: 'store-1', status: 'ACTIVE' },
      }),
    );
  });

  it('does not expose another stores catalog', async () => {
    findMembership.mockResolvedValue(null);

    await expect(
      service.findProducts('store-2', 'user-1', { limit: 10 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findProducts).not.toHaveBeenCalled();
  });
});

function createListProduct(id: string) {
  return {
    id,
    title: `Product ${id}`,
    brand: 'North Studio',
    category: 'Giyim',
    status: 'ACTIVE',
    updatedAt: new Date('2026-08-30T12:00:00.000Z'),
    images: [{ url: 'https://example.com/product.jpg' }],
    variants: [
      { price: 100, currency: 'TRY', stock: 5, status: 'ACTIVE' },
      { price: 120, currency: 'TRY', stock: 3, status: 'OUT_OF_STOCK' },
    ],
    externalProducts: [
      {
        status: 'ACTIVE',
        connection: { providerKey: 'trendyol' },
      },
    ],
  };
}
