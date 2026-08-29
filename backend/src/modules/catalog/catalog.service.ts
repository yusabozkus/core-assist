import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async findProducts(storeId: string, userId: string) {
    const membership = await this.prisma.storeMember.findUnique({
      where: {
        storeId_userId: { storeId, userId },
      },
      select: { id: true },
    });

    if (!membership) {
      throw new NotFoundException('Mağaza bulunamadı veya erişiminiz yok.');
    }

    return this.prisma.product.findMany({
      where: { storeId },
      orderBy: { updatedAt: 'desc' },
      select: {
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
            lastSyncedAt: true,
            connection: {
              select: { providerKey: true },
            },
          },
        },
      },
    });
  }
}
