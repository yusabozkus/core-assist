import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CatalogSyncKind,
  CatalogSyncStatus,
  ChannelConnectionStatus,
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
import { AuditAction } from '../audit/audit-actions';
import {
  AuditActorType,
  AuditLogService,
  AuditOrigin,
  AuditResult,
} from '../audit/audit-log.service';
import { randomUUID } from 'node:crypto';

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingEntitlements: BillingEntitlementService,
    private readonly audit: AuditLogService,
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

      const createdStore = await transaction.store.create({
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
      await this.audit.record(
        {
          actorType: AuditActorType.USER,
          actorUserId: userId,
          origin: AuditOrigin.API,
          action: AuditAction.STORE_CREATED,
          result: AuditResult.SUCCESS,
          workspaceId: membership.workspaceId,
          storeId: createdStore.id,
          targetType: 'STORE',
          targetId: createdStore.id,
          after: storeAuditSnapshot(createdStore),
        },
        transaction,
      );
      return createdStore;
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
        knowledgeProfile: {
          select: { shippingPolicy: true, returnPolicy: true },
        },
        channelConnections: {
          where: {
            removedAt: null,
            status: ChannelConnectionStatus.CONNECTED,
            credentialsEncrypted: { not: null },
            syncRuns: {
              some: {
                kind: CatalogSyncKind.FULL,
                OR: [
                  { status: CatalogSyncStatus.COMPLETED },
                  {
                    status: CatalogSyncStatus.RUNNING,
                    productsProcessed: { gt: 0 },
                  },
                ],
              },
            },
          },
          take: 1,
          select: { id: true },
        },
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

    return stores.map(
      ({
        members,
        workspace,
        knowledgeProfile,
        channelConnections,
        ...store
      }) => ({
        ...store,
        setupComplete: Boolean(
          knowledgeProfile?.shippingPolicy?.trim() &&
          knowledgeProfile?.returnPolicy?.trim() &&
          channelConnections.length > 0,
        ),
        accessLevel: resolveTeamAccessLevel(
          workspace.members[0]?.role ?? WorkspaceRole.MEMBER,
          members,
        ),
      }),
    );
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
      select: {
        id: true,
        workspaceId: true,
        name: true,
        inventoryPolicy: true,
        status: true,
      },
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

      await this.audit.record(
        {
          actorType: AuditActorType.USER,
          actorUserId: userId,
          origin: AuditOrigin.API,
          action: AuditAction.STORE_UPDATED,
          result: AuditResult.SUCCESS,
          workspaceId: store.workspaceId,
          storeId: store.id,
          targetType: 'STORE',
          targetId: store.id,
          before: storeAuditSnapshot(store),
          after: storeAuditSnapshot(updatedStore),
        },
        transaction,
      );

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
          workspaceId: true,
          name: true,
          inventoryPolicy: true,
          status: true,
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
                  QuestionAnswerStatus.REVIEW_REQUIRED,
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

      // Revoke only this store's current generation, even if it is restored
      // before an in-flight model call returns. Preserve the workspace cooldown.
      // Lock the lease before question rows, matching draft commit/recovery.
      const revokedToken = randomUUID();
      await transaction.$executeRaw`
        UPDATE "ai_draft_lease" AS lease
        SET "token" = ${revokedToken}, "expiresAt" = CURRENT_TIMESTAMP
        FROM "product_question" AS question
        WHERE lease."workspaceId" = ${store.workspaceId}
          AND lease."questionId" = question."id" AND question."storeId" = ${id}
      `;
      await transaction.productQuestion.updateMany({
        where: {
          storeId: id,
          draftProcessingStatus: { not: null },
        },
        data: {
          draftProcessingStatus: null,
          draftProcessingError: null,
          draftQueuedAt: null,
          draftProcessingStartedAt: null,
        },
      });

      await this.audit.record(
        {
          actorType: AuditActorType.USER,
          actorUserId: userId,
          origin: AuditOrigin.API,
          action: AuditAction.STORE_ARCHIVED,
          result: AuditResult.SUCCESS,
          workspaceId: store.workspaceId,
          storeId: store.id,
          targetType: 'STORE',
          targetId: store.id,
          before: storeAuditSnapshot(store),
          after: { ...storeAuditSnapshot(store), status: StoreStatus.INACTIVE },
        },
        transaction,
      );

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
        select: {
          id: true,
          workspaceId: true,
          name: true,
          inventoryPolicy: true,
          status: true,
        },
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

      const restoredStore = await transaction.store.update({
        where: { id },
        data: { status: StoreStatus.ACTIVE },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
        },
      });
      await this.audit.record(
        {
          actorType: AuditActorType.USER,
          actorUserId: userId,
          origin: AuditOrigin.API,
          action: AuditAction.STORE_RESTORED,
          result: AuditResult.SUCCESS,
          workspaceId: store.workspaceId,
          storeId: store.id,
          targetType: 'STORE',
          targetId: store.id,
          before: storeAuditSnapshot(store),
          after: storeAuditSnapshot(restoredStore),
        },
        transaction,
      );
      return restoredStore;
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
          workspaceId: true,
          name: true,
          inventoryPolicy: true,
          status: true,
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
                  QuestionAnswerStatus.REVIEW_REQUIRED,
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
      await this.audit.record(
        {
          actorType: AuditActorType.USER,
          actorUserId: userId,
          origin: AuditOrigin.API,
          action: AuditAction.STORE_DELETED,
          result: AuditResult.SUCCESS,
          workspaceId: store.workspaceId,
          storeId: store.id,
          targetType: 'STORE',
          targetId: store.id,
          before: storeAuditSnapshot(store),
          after: { deleted: true },
        },
        transaction,
      );

      return {
        deleted: true as const,
        deletedStoreId: store.id,
        nextStore,
      };
    });
  }
}

function storeAuditSnapshot(store: {
  name: string;
  inventoryPolicy?: InventoryPolicy | null;
  status: StoreStatus;
}) {
  return {
    name: store.name,
    inventoryPolicy: store.inventoryPolicy ?? null,
    status: store.status,
  };
}
