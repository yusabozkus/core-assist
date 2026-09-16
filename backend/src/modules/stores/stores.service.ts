import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryPolicy,
  QuestionAnswerStatus,
  StoreRole,
  StoreStatus,
  WorkspaceRole,
} from '../../generated/prisma/enums';
import { CreateStoreDto } from './dto/create-store.dto';
import {
  DeleteStoreDto,
  STORE_DELETE_CONFIRMATION,
} from './dto/delete-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { PrismaService } from '../../database/prisma.service';
import { createDefaultStoreAiInstructions } from '../knowledge/default-ai-instructions';
import { BillingEntitlementService } from '../billing/billing-entitlement.service';
import { resolveTeamAccessLevel } from '../team/team-access';
import { recalculateStoreVariantInventory } from '../product-sync/inventory-policy';

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingEntitlements: BillingEntitlementService,
  ) {}

  async create(userId: string, createStoreDto: CreateStoreDto) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: {
        userId,
        role: {
          in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const membership =
      memberships.find((candidate) => candidate.role === WorkspaceRole.OWNER) ??
      memberships[0];

    if (!membership) {
      throw new ForbiddenException('Mağaza oluşturma yetkiniz bulunmuyor.');
    }

    return this.prisma.$transaction(async (transaction) => {
      await this.billingEntitlements.assertStoreCapacityInTransaction(
        transaction,
        membership.workspaceId,
      );
      const workspaceManagers = await transaction.workspaceMember.findMany({
        where: {
          workspaceId: membership.workspaceId,
          role: { in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN] },
        },
        select: { userId: true, role: true },
      });

      return transaction.store.create({
        data: {
          name: createStoreDto.name,
          workspaceId: membership.workspaceId,
          inventoryPolicy:
            createStoreDto.inventoryPolicy ?? InventoryPolicy.SHARED,
          members: {
            create: workspaceManagers.map((manager) => ({
              userId: manager.userId,
              role:
                manager.role === WorkspaceRole.OWNER
                  ? StoreRole.OWNER
                  : StoreRole.ADMIN,
            })),
          },
          aiInstructions: {
            create: createDefaultStoreAiInstructions(),
          },
        },
        select: {
          id: true,
          name: true,
          inventoryPolicy: true,
          status: true,
          createdAt: true,
        },
      });
    });
  }

  async findAllForUser(userId: string) {
    const stores = await this.prisma.store.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        inventoryPolicy: true,
        status: true,
        createdAt: true,
        members: {
          where: { userId },
          take: 1,
          select: { role: true },
        },
        workspace: {
          select: {
            members: {
              where: { userId },
              take: 1,
              select: { role: true },
            },
          },
        },
      },
    });

    return stores.map(({ members, workspace, ...store }) => ({
      ...store,
      accessLevel: resolveTeamAccessLevel(
        workspace.members[0]?.role ?? WorkspaceRole.MEMBER,
        members,
      ),
    }));
  }

  async findOne(id: string, userId: string) {
    const store = await this.prisma.store.findFirst({
      where: {
        id,
        members: {
          some: {
            userId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        inventoryPolicy: true,
        status: true,
        createdAt: true,
      },
    });

    if (!store) {
      throw new NotFoundException('Store not found or unauthorized');
    }

    return store;
  }

  async findArchivedForUser(userId: string) {
    return this.prisma.store.findMany({
      where: {
        status: StoreStatus.INACTIVE,
        members: { some: { userId } },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async update(id: string, userId: string, updateStoreDto: UpdateStoreDto) {
    if (
      updateStoreDto.name === undefined &&
      updateStoreDto.inventoryPolicy === undefined
    ) {
      throw new BadRequestException('Güncellenecek mağaza bilgisini girin.');
    }

    const store = await this.prisma.store.findFirst({
      where: {
        id,
        members: {
          some: {
            userId,
            role: { in: [StoreRole.OWNER, StoreRole.ADMIN] },
          },
        },
      },
      select: { id: true },
    });

    if (!store) {
      throw new NotFoundException(
        'Mağaza bulunamadı veya güncelleme yetkiniz yok.',
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      const updatedStore = await transaction.store.update({
        where: { id: store.id },
        data: {
          ...(updateStoreDto.name === undefined
            ? {}
            : { name: updateStoreDto.name }),
          ...(updateStoreDto.inventoryPolicy === undefined
            ? {}
            : { inventoryPolicy: updateStoreDto.inventoryPolicy }),
        },
        select: {
          id: true,
          name: true,
          inventoryPolicy: true,
          status: true,
          createdAt: true,
        },
      });

      if (updateStoreDto.inventoryPolicy !== undefined) {
        await recalculateStoreVariantInventory(
          transaction,
          store.id,
          updateStoreDto.inventoryPolicy,
        );
      }

      return updatedStore;
    });
  }

  async archive(id: string, userId: string) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT "id"
        FROM "store"
        WHERE "id" = ${id}
        FOR UPDATE
      `;

      const store = await transaction.store.findFirst({
        where: {
          id,
          status: StoreStatus.ACTIVE,
          members: {
            some: {
              userId,
              role: { in: [StoreRole.OWNER, StoreRole.ADMIN] },
            },
          },
        },
        select: {
          id: true,
          channelConnections: {
            where: {
              OR: [
                { processingStartedAt: { not: null } },
                { questionSyncStartedAt: { not: null } },
              ],
            },
            take: 1,
            select: { id: true },
          },
          questionAnswers: {
            where: {
              status: {
                in: [
                  QuestionAnswerStatus.QUEUED,
                  QuestionAnswerStatus.PROCESSING,
                ],
              },
            },
            take: 1,
            select: { id: true },
          },
        },
      });

      if (!store) {
        throw new NotFoundException(
          'Mağaza bulunamadı, zaten arşivlenmiş veya yetkiniz yok.',
        );
      }

      if (
        store.channelConnections.length > 0 ||
        store.questionAnswers.length > 0
      ) {
        throw new ConflictException(
          'Kuyruktaki işlemler, senkronizasyonlar veya cevap gönderimleri tamamlanmadan mağaza arşivlenemez.',
        );
      }

      await transaction.store.update({
        where: { id },
        data: { status: StoreStatus.INACTIVE },
      });

      return {
        archived: true as const,
        archivedStoreId: id,
      };
    });
  }

  async restore(id: string, userId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const store = await transaction.store.findFirst({
        where: {
          id,
          status: StoreStatus.INACTIVE,
          members: {
            some: {
              userId,
              role: { in: [StoreRole.OWNER, StoreRole.ADMIN] },
            },
          },
        },
        select: { id: true, workspaceId: true },
      });

      if (!store) {
        throw new NotFoundException(
          'Arşivlenen mağaza bulunamadı, zaten aktif veya yetkiniz yok.',
        );
      }

      await this.billingEntitlements.assertStoreCapacityInTransaction(
        transaction,
        store.workspaceId,
      );

      return transaction.store.update({
        where: { id },
        data: { status: StoreStatus.ACTIVE },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
        },
      });
    });
  }

  async remove(id: string, userId: string, deleteStoreDto: DeleteStoreDto) {
    if (deleteStoreDto.confirmation !== STORE_DELETE_CONFIRMATION) {
      throw new BadRequestException(
        `Silme onayı birebir "${STORE_DELETE_CONFIRMATION}" olmalıdır.`,
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT "id"
        FROM "store"
        WHERE "id" = ${id}
        FOR UPDATE
      `;

      const store = await transaction.store.findFirst({
        where: {
          id,
          members: {
            some: {
              userId,
              role: { in: [StoreRole.OWNER, StoreRole.ADMIN] },
            },
          },
        },
        select: {
          id: true,
          channelConnections: {
            where: {
              OR: [
                { processingStartedAt: { not: null } },
                { questionSyncStartedAt: { not: null } },
              ],
            },
            take: 1,
            select: { id: true },
          },
          questionAnswers: {
            where: {
              status: {
                in: [
                  QuestionAnswerStatus.QUEUED,
                  QuestionAnswerStatus.PROCESSING,
                ],
              },
            },
            take: 1,
            select: { id: true },
          },
        },
      });

      if (!store) {
        throw new NotFoundException(
          'Mağaza bulunamadı veya silme yetkiniz yok.',
        );
      }

      if (
        store.channelConnections.length > 0 ||
        store.questionAnswers.length > 0
      ) {
        throw new ConflictException(
          'Kuyruktaki işlemler, senkronizasyonlar veya cevap gönderimleri tamamlanmadan mağaza silinemez.',
        );
      }

      const nextStore = await transaction.store.findFirst({
        where: {
          id: { not: id },
          members: { some: { userId } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
        },
      });

      await transaction.store.delete({ where: { id: store.id } });

      return {
        deleted: true as const,
        deletedStoreId: store.id,
        nextStore,
      };
    });
  }
}
