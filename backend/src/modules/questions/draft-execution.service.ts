import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { StoreStatus } from '../../generated/prisma/enums';

export const DRAFT_LEASE_MS = 5 * 60_000;
export const DRAFT_COOLDOWN_MS = 5_000;
const MAX_LEASE_LIFETIME_MS = 10 * 60_000;

export class DraftStoreInactiveException extends ConflictException {
  constructor() {
    super({
      statusCode: HttpStatus.CONFLICT,
      code: 'AI_STORE_INACTIVE',
      message:
        'Arşivlenmiş veya silinmiş bir mağaza için AI taslağı oluşturulamaz.',
    });
  }
}

export class DraftCapacityException extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code: 'AI_RATE_LIMITED',
        message:
          'Hesabınızda AI taslağı hazırlanıyor veya kısa süre önce bir istek yapıldı. 5 saniye sonra tekrar deneyin.',
        retryAfterSeconds: 5,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export type DraftExecution = {
  assertActive(transaction?: Prisma.TransactionClient): Promise<void>;
};

@Injectable()
export class DraftExecutionService {
  private readonly logger = new Logger(DraftExecutionService.name);
  constructor(private readonly prisma: PrismaService) {}

  async run<T>(
    storeId: string,
    questionId: string,
    work: (execution: DraftExecution) => Promise<T>,
  ): Promise<T> {
    const question = await this.prisma.productQuestion.findFirst({
      where: { id: questionId, storeId },
      select: { store: { select: { workspaceId: true, status: true } } },
    });
    if (!question) throw new NotFoundException('Ürün sorusu bulunamadı.');
    if (question.store.status !== StoreStatus.ACTIVE)
      throw new DraftStoreInactiveException();
    const workspaceId = question.store.workspaceId;
    const token = randomUUID();
    const acquired = await this.prisma.$transaction(async (tx) => {
      await this.lockWorkspace(tx, workspaceId);
      await this.assertStoreActive(storeId, tx);
      return tx.$queryRaw<Array<{ token: string }>>`
      INSERT INTO "ai_draft_lease" ("workspaceId", "questionId", "token", "expiresAt", "startedAt")
      VALUES (${workspaceId}, ${questionId}, ${token}, CURRENT_TIMESTAMP + ${DRAFT_LEASE_MS} * interval '1 millisecond', CURRENT_TIMESTAMP)
      ON CONFLICT ("workspaceId") DO UPDATE SET "questionId" = EXCLUDED."questionId",
        "token" = EXCLUDED."token", "expiresAt" = EXCLUDED."expiresAt", "startedAt" = EXCLUDED."startedAt"
      WHERE "ai_draft_lease"."expiresAt" <= CURRENT_TIMESTAMP
        AND "ai_draft_lease"."startedAt" <= CURRENT_TIMESTAMP - ${DRAFT_COOLDOWN_MS} * interval '1 millisecond'
      RETURNING "token"
      `;
    });
    if (acquired.length !== 1) throw new DraftCapacityException();
    let lost = false;
    const assertActive = async (transaction?: Prisma.TransactionClient) => {
      // In the final draft/quota transaction this locks the same row as
      // archive(), so the archive and successful commit have one clear order.
      await this.assertStoreActive(storeId, transaction);
      if (lost) throw new DraftCapacityException();
      const tx = transaction ?? this.prisma;
      const renewed = await tx.$queryRaw<Array<{ token: string }>>`
        UPDATE "ai_draft_lease" SET "expiresAt" = CURRENT_TIMESTAMP + ${DRAFT_LEASE_MS} * interval '1 millisecond'
        WHERE "workspaceId" = ${workspaceId} AND "token" = ${token}
          AND "expiresAt" > CURRENT_TIMESTAMP
          AND "startedAt" > CURRENT_TIMESTAMP - ${MAX_LEASE_LIFETIME_MS} * interval '1 millisecond'
        RETURNING "token"
      `;
      if (renewed.length !== 1) {
        lost = true;
        throw new DraftCapacityException();
      }
    };
    let pendingRenewal: Promise<void> | undefined;
    const heartbeat = setInterval(() => {
      if (pendingRenewal) return;
      pendingRenewal = assertActive()
        .catch(() => {
          lost = true;
        })
        .finally(() => {
          pendingRenewal = undefined;
        });
    }, 30_000);
    heartbeat.unref();
    try {
      return await work({ assertActive });
    } finally {
      clearInterval(heartbeat);
      if (pendingRenewal) await pendingRenewal;
      try {
        // Keep startedAt for the request cooldown; fencing protects a newer owner.
        await this.prisma
          .$executeRaw`UPDATE "ai_draft_lease" SET "expiresAt" = CURRENT_TIMESTAMP
          WHERE "workspaceId" = ${workspaceId} AND "token" = ${token}`;
      } catch {
        this.logger.warn(
          'AI draft lease release failed; expiry will release it.',
        );
      }
    }
  }

  private async assertStoreActive(
    storeId: string,
    transaction?: Prisma.TransactionClient,
  ) {
    const store = transaction
      ? (
          await transaction.$queryRaw<Array<{ status: StoreStatus }>>`
            SELECT "status" FROM "store" WHERE "id" = ${storeId} FOR UPDATE
          `
        )[0]
      : await this.prisma.store.findUnique({
          where: { id: storeId },
          select: { status: true },
        });
    if (store?.status !== StoreStatus.ACTIVE)
      throw new DraftStoreInactiveException();
  }

  async recoverAbandonedProcessing(
    workspaceId: string,
    questionId: string,
    restore: (tx: Prisma.TransactionClient) => Promise<boolean>,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      // Acquisition uses this same lock, including when no lease row exists.
      // NO KEY UPDATE does not block ordinary workspace FK inserts.
      await this.lockWorkspace(tx, workspaceId);
      const leases = await tx.$queryRaw<
        Array<{ questionId: string; active: boolean }>
      >`
        SELECT "questionId", "expiresAt" > CURRENT_TIMESTAMP AS "active"
        FROM "ai_draft_lease" WHERE "workspaceId" = ${workspaceId} FOR UPDATE
      `;
      if (leases[0]?.questionId === questionId && leases[0].active)
        return false;
      if (leases[0]?.questionId === questionId) {
        // A transaction may have begun before expiry: CURRENT_TIMESTAMP is
        // fixed at its start. Replace the expired token so even that late
        // transaction cannot renew/commit after the recovery releases its lock.
        const revokedToken = randomUUID();
        await tx.$executeRaw`
          UPDATE "ai_draft_lease" SET "token" = ${revokedToken}
          WHERE "workspaceId" = ${workspaceId} AND "questionId" = ${questionId}
        `;
      }
      // Preserve startedAt for cooldown and never revoke another question's
      // valid lease just to restore this old processing marker.
      return restore(tx);
    });
  }

  private async lockWorkspace(
    tx: Prisma.TransactionClient,
    workspaceId: string,
  ) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "workspace" WHERE "id" = ${workspaceId} FOR NO KEY UPDATE
    `;
    if (!rows.length) throw new NotFoundException('Müşteri hesabı bulunamadı.');
  }
}
