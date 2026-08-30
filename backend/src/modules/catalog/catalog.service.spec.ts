import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  const findMembership = jest.fn();
  const findProducts = jest.fn();
  const prisma = {
    storeMember: { findUnique: findMembership },
    product: { findMany: findProducts },
  } as unknown as PrismaService;
  const service = new CatalogService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the normalized catalog for store members', async () => {
    findMembership.mockResolvedValue({ id: 'member-1' });
    findProducts.mockResolvedValue([
      { id: 'product-1', variants: [{ id: 'variant-1', price: 100 }] },
    ]);

    const products = await service.findProducts('store-1', 'user-1');

    expect(products).toEqual([
      { id: 'product-1', variants: [{ id: 'variant-1', price: 100 }] },
    ]);
    expect(findProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId: 'store-1', status: 'ACTIVE' },
      }),
    );
  });

  it('does not expose another stores catalog', async () => {
    findMembership.mockResolvedValue(null);

    await expect(
      service.findProducts('store-2', 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findProducts).not.toHaveBeenCalled();
  });
});
