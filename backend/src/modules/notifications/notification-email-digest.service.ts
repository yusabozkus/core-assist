import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  ChannelConnectionStatus,
  NotificationType,
  ExternalEntityStatus,
  StockEmailAlertLevel,
  StoreRole,
  WorkspaceRole,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import {
  LOW_STOCK_COALESCE_MS,
  LOW_STOCK_DIGEST_MIN_GAP_MS,
  OUT_OF_STOCK_COALESCE_MS,
} from './notification-email-digest.constants';

type NewReviewsRow = { count: number; latestAt: Date | null };

const RECIPIENT_BATCH_SIZE = 100;
const CLAIM_DURATION_MS = 2 * 60_000;

@Injectable()
export class NotificationEmailDigestService {
  private readonly logger = new Logger(NotificationEmailDigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: NotificationDeliveryService,
  ) {}

  async sendAiReviewDigests() {
    await this.forEachEmailRecipient(
      (userId, storeId) => this.sendForRecipient(userId, storeId),
      'AI inceleme özeti',
    );
  }

  async sendStockDigests(level: StockEmailAlertLevel) {
    await this.forEachEmailRecipient(
      (userId, storeId) => this.sendStockForRecipient(userId, storeId, level),
      level === StockEmailAlertLevel.OUT_OF_STOCK
        ? 'Tükenen stok özeti'
        : 'Kritik stok özeti',
    );
  }

  private async forEachEmailRecipient(
    send: (userId: string, storeId: string) => Promise<void>,
    label: string,
  ) {
    if (!this.delivery.emailConfigured) return;

    let lastId: string | undefined;
    let failedRecipients = 0;
    while (true) {
      const recipients = await this.prisma.notificationDeliverySetting.findMany(
        {
          where: {
            emailEnabled: true,
            ...(lastId ? { id: { gt: lastId } } : {}),
          },
          orderBy: { id: 'asc' },
          take: RECIPIENT_BATCH_SIZE,
          select: { id: true, userId: true, storeId: true },
        },
      );
      if (recipients.length === 0) break;

      for (const recipient of recipients) {
        try {
          await send(recipient.userId, recipient.storeId);
        } catch (error) {
          failedRecipients += 1;
          this.logger.warn(
            `${label} gönderilemedi (${recipient.userId}, ${recipient.storeId}): ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
          );
        }
      }

      lastId = recipients[recipients.length - 1].id;
    }

    if (failedRecipients > 0) {
      throw new Error(`${failedRecipients} ${label} yeniden denenecek.`);
    }
  }

  private async sendForRecipient(recipientUserId: string, storeId: string) {
    const store = await this.findEligibleStore(
      recipientUserId,
      storeId,
      NotificationType.AI_REVIEW_REQUIRED,
    );
    if (!store) return;

    const digest = await this.prisma.notificationEmailDigestState.upsert({
      where: {
        recipientUserId_storeId_type: {
          recipientUserId,
          storeId,
          type: NotificationType.AI_REVIEW_REQUIRED,
        },
      },
      create: {
        recipientUserId,
        storeId,
        type: NotificationType.AI_REVIEW_REQUIRED,
      },
      update: {},
    });

    const claimToken = randomUUID();
    const claimed = await this.prisma.notificationEmailDigestState.updateMany({
      where: {
        id: digest.id,
        OR: [{ claimUntil: null }, { claimUntil: { lte: new Date() } }],
      },
      data: {
        claimToken,
        claimUntil: new Date(Date.now() + CLAIM_DURATION_MS),
      },
    });
    if (claimed.count === 0) return;

    try {
      const pendingCount = await this.prisma.productQuestion.count({
        where: {
          storeId,
          status: 'DRAFTED',
          draftDecision: 'NEEDS_REVIEW',
        },
      });
      if (pendingCount === 0) {
        await this.clearPending(digest.id, claimToken, digest.pendingUntil);
        return;
      }

      const [newReviews] = await this.prisma.$queryRaw<NewReviewsRow[]>(
        Prisma.sql`
          SELECT COUNT(DISTINCT q."id")::int AS "count",
                 MAX(n."createdAt") AS "latestAt"
          FROM "notification" n
          JOIN "product_question" q ON q."id" = n."entityId"
          WHERE n."recipientUserId" = ${recipientUserId}
            AND n."storeId" = ${storeId}
            AND n."type" = 'AI_REVIEW_REQUIRED'::"NotificationType"
            AND n."entityType" = 'PRODUCT_QUESTION'
            AND n."readAt" IS NULL
            AND q."storeId" = ${storeId}
            AND q."status" = 'DRAFTED'::"ProductQuestionStatus"
            AND q."draftDecision" = 'NEEDS_REVIEW'::"QuestionReplyDecision"
            ${digest.lastIncludedAt ? Prisma.sql`AND n."createdAt" > ${digest.lastIncludedAt}` : Prisma.empty}
            ${digest.pendingUntil ? Prisma.sql`AND n."createdAt" <= ${digest.pendingUntil}` : Prisma.empty}
        `,
      );
      if (!newReviews?.count || !newReviews.latestAt) {
        await this.clearPending(digest.id, claimToken, digest.pendingUntil);
        return;
      }

      const pendingUntil = digest.pendingUntil ?? newReviews.latestAt;
      const idempotencyKey =
        digest.idempotencyKey ??
        `ai-review:${digest.id}:${pendingUntil.getTime()}`;
      if (!digest.pendingUntil) {
        await this.prisma.notificationEmailDigestState.updateMany({
          where: { id: digest.id, claimToken },
          data: { pendingUntil, idempotencyKey },
        });
      }

      const sent = await this.delivery.sendAiReviewDigest(
        recipientUserId,
        storeId,
        store.name,
        pendingCount,
        newReviews.count,
        idempotencyKey,
      );
      if (!sent) {
        if (!digest.pendingUntil) {
          await this.prisma.notificationEmailDigestState.updateMany({
            where: { id: digest.id, claimToken },
            data: { pendingUntil: null, idempotencyKey: null },
          });
        }
        return;
      }

      await this.prisma.notificationEmailDigestState.updateMany({
        where: { id: digest.id, claimToken },
        data: {
          lastIncludedAt: pendingUntil,
          lastSentAt: new Date(),
          pendingUntil: null,
          idempotencyKey: null,
        },
      });
    } finally {
      await this.prisma.notificationEmailDigestState.updateMany({
        where: { id: digest.id, claimToken },
        data: { claimToken: null, claimUntil: null },
      });
    }
  }

  private async sendStockForRecipient(
    recipientUserId: string,
    storeId: string,
    level: StockEmailAlertLevel,
  ) {
    const type =
      level === StockEmailAlertLevel.OUT_OF_STOCK
        ? NotificationType.OUT_OF_STOCK
        : NotificationType.LOW_STOCK;
    const store = await this.findEligibleStore(recipientUserId, storeId, type);
    if (!store) return;

    const digest = await this.prisma.notificationEmailDigestState.upsert({
      where: {
        recipientUserId_storeId_type: { recipientUserId, storeId, type },
      },
      create: { recipientUserId, storeId, type },
      update: {},
    });

    const now = new Date();
    if (
      type === NotificationType.LOW_STOCK &&
      digest.lastSentAt &&
      now.getTime() - digest.lastSentAt.getTime() < LOW_STOCK_DIGEST_MIN_GAP_MS
    ) {
      return;
    }

    const claimToken = randomUUID();
    const claimed = await this.prisma.notificationEmailDigestState.updateMany({
      where: {
        id: digest.id,
        OR: [{ claimUntil: null }, { claimUntil: { lte: now } }],
      },
      data: {
        claimToken,
        claimUntil: new Date(now.getTime() + CLAIM_DURATION_MS),
      },
    });
    if (claimed.count === 0) return;

    try {
      const activeVariants = {
        status: ExternalEntityStatus.ACTIVE,
        externalProduct: {
          status: ExternalEntityStatus.ACTIVE,
          connection: {
            storeId,
            status: ChannelConnectionStatus.CONNECTED,
          },
        },
        stock:
          level === StockEmailAlertLevel.OUT_OF_STOCK ? 0 : { gt: 0, lte: 5 },
      } satisfies Prisma.ExternalProductVariantWhereInput;
      const coalesceMs =
        level === StockEmailAlertLevel.OUT_OF_STOCK
          ? OUT_OF_STOCK_COALESCE_MS
          : LOW_STOCK_COALESCE_MS;
      const windowEnd =
        digest.pendingUntil ?? new Date(now.getTime() - coalesceMs);
      const [currentCount, newCount] = await Promise.all([
        this.prisma.externalProductVariant.count({ where: activeVariants }),
        this.prisma.externalProductVariant.count({
          where: {
            ...activeVariants,
            stockEmailAlertLevel: level,
            stockEmailAlertStartedAt: {
              ...(digest.lastIncludedAt
                ? { gt: digest.lastIncludedAt }
                : { not: null }),
              lte: windowEnd,
            },
          },
        }),
      ]);
      if (newCount === 0) {
        await this.clearPending(digest.id, claimToken, digest.pendingUntil);
        return;
      }

      const featuredVariants =
        await this.prisma.externalProductVariant.findMany({
          where: {
            ...activeVariants,
            stockEmailAlertLevel: level,
            stockEmailAlertStartedAt: {
              ...(digest.lastIncludedAt
                ? { gt: digest.lastIncludedAt }
                : { not: null }),
              lte: windowEnd,
            },
          },
          orderBy: [{ stockEmailAlertStartedAt: 'desc' }, { id: 'asc' }],
          take: 3,
          select: {
            stock: true,
            productVariant: {
              select: { title: true, color: true, size: true, sku: true },
            },
            externalProduct: {
              select: {
                product: {
                  select: {
                    title: true,
                    images: {
                      orderBy: [{ position: 'asc' }, { id: 'asc' }],
                      take: 1,
                      select: { url: true },
                    },
                  },
                },
              },
            },
          },
        });
      const products = featuredVariants.map((variant) => ({
        name: variant.externalProduct.product.title,
        variant:
          [variant.productVariant.color, variant.productVariant.size]
            .filter(Boolean)
            .join(' · ') ||
          variant.productVariant.title?.trim() ||
          variant.productVariant.sku,
        stock: variant.stock,
        imageUrl: variant.externalProduct.product.images[0]?.url ?? null,
      }));

      const idempotencyKey =
        digest.idempotencyKey ??
        `stock:${type}:${digest.id}:${windowEnd.getTime()}`;
      if (!digest.pendingUntil) {
        await this.prisma.notificationEmailDigestState.updateMany({
          where: { id: digest.id, claimToken },
          data: { pendingUntil: windowEnd, idempotencyKey },
        });
      }

      const sent = await this.delivery.sendStockDigest(
        recipientUserId,
        storeId,
        store.name,
        type,
        currentCount,
        newCount,
        idempotencyKey,
        products,
      );
      if (!sent) {
        if (!digest.pendingUntil) {
          await this.prisma.notificationEmailDigestState.updateMany({
            where: { id: digest.id, claimToken },
            data: { pendingUntil: null, idempotencyKey: null },
          });
        }
        return;
      }

      await this.prisma.notificationEmailDigestState.updateMany({
        where: { id: digest.id, claimToken },
        data: {
          lastIncludedAt: windowEnd,
          lastSentAt: new Date(),
          pendingUntil: null,
          idempotencyKey: null,
        },
      });
    } finally {
      await this.prisma.notificationEmailDigestState.updateMany({
        where: { id: digest.id, claimToken },
        data: { claimToken: null, claimUntil: null },
      });
    }
  }

  private async findEligibleStore(
    recipientUserId: string,
    storeId: string,
    type: NotificationType,
  ) {
    const [store, preference] = await Promise.all([
      this.prisma.store.findFirst({
        where: {
          id: storeId,
          status: 'ACTIVE',
          OR: [
            { workspace: { ownerId: recipientUserId } },
            {
              workspace: {
                members: {
                  some: {
                    userId: recipientUserId,
                    role: WorkspaceRole.ADMIN,
                  },
                },
              },
            },
            {
              members: {
                some: {
                  userId: recipientUserId,
                  role: {
                    in: [StoreRole.OWNER, StoreRole.ADMIN, StoreRole.AGENT],
                  },
                },
              },
            },
          ],
        },
        select: { id: true, name: true },
      }),
      this.prisma.notificationPreference.findUnique({
        where: {
          userId_storeId_type: {
            userId: recipientUserId,
            storeId,
            type,
          },
        },
        select: { enabled: true },
      }),
    ]);
    return preference?.enabled === false ? null : store;
  }

  private async clearPending(
    id: string,
    claimToken: string,
    pendingUntil: Date | null,
  ) {
    await this.prisma.notificationEmailDigestState.updateMany({
      where: { id, claimToken },
      data: {
        ...(pendingUntil ? { lastIncludedAt: pendingUntil } : {}),
        pendingUntil: null,
        idempotencyKey: null,
      },
    });
  }
}
