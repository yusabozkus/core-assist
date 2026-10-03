import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';

export const DRAFT_LEASE_MS = 5 * 60_000;
export const DRAFT_COOLDOWN_MS = 5_000;
const MAX_LEASE_LIFETIME_MS = 10 * 60_000;

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
      select: { store: { select: { workspaceId: true } } },
    });
    if (!question) throw new NotFoundException('Ürün sorusu bulunamadı.');
    const workspaceId = question.store.workspaceId;
    const token = randomUUID();
    const acquired = await this.prisma.$queryRaw<Array<{ token: string }>>`
      INSERT INTO "ai_draft_lease" ("workspaceId", "questionId", "token", "expiresAt", "startedAt")
      VALUES (${workspaceId}, ${questionId}, ${token}, CURRENT_TIMESTAMP + ${DRAFT_LEASE_MS} * interval '1 millisecond', CURRENT_TIMESTAMP)
      ON CONFLICT ("workspaceId") DO UPDATE SET "questionId" = EXCLUDED."questionId",
        "token" = EXCLUDED."token", "expiresAt" = EXCLUDED."expiresAt", "startedAt" = EXCLUDED."startedAt"
      WHERE "ai_draft_lease"."expiresAt" <= CURRENT_TIMESTAMP
        AND "ai_draft_lease"."startedAt" <= CURRENT_TIMESTAMP - ${DRAFT_COOLDOWN_MS} * interval '1 millisecond'
      RETURNING "token"
    `;
    if (acquired.length !== 1) throw new DraftCapacityException();
    let lost = false;
    const assertActive = async (tx: Prisma.TransactionClient = this.prisma) => {
      if (lost) throw new DraftCapacityException();
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
}
