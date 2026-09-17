import { HttpException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  AuditActorType,
  AuditOrigin,
  AuditResult,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { LoggingContext } from '../../infrastructure/logging/logging-context';
import { sanitizeLogValue } from '../../infrastructure/logging/structured-logger';

const MAX_IDENTIFIER_LENGTH = 160;
const MAX_AUDIT_JSON_BYTES = 16 * 1024;

type AuditDatabaseClient = Pick<Prisma.TransactionClient, 'auditLog'>;

export type RecordAuditLogInput = {
  actorType: AuditActorType;
  actorUserId?: string | null;
  origin: AuditOrigin;
  action: string;
  result: AuditResult;
  workspaceId?: string | null;
  storeId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  errorCode?: string | null;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  record(
    input: RecordAuditLogInput,
    client: AuditDatabaseClient = this.prisma,
  ) {
    const context = LoggingContext.get();
    return client.auditLog.create({
      data: {
        actorType: input.actorType,
        actorUserId: normalizeIdentifier(input.actorUserId),
        origin: input.origin,
        action: requireIdentifier(input.action, 'action'),
        result: input.result,
        workspaceId: normalizeIdentifier(input.workspaceId),
        storeId: normalizeIdentifier(input.storeId),
        targetType: normalizeIdentifier(input.targetType),
        targetId: normalizeIdentifier(input.targetId),
        requestId: normalizeIdentifier(context?.requestId),
        ipAddress: normalizeText(context?.ipAddress, 64),
        userAgent: normalizeText(context?.userAgent, 500),
        errorCode: normalizeIdentifier(input.errorCode),
        before: sanitizeAuditPayload(input.before),
        after: sanitizeAuditPayload(input.after),
        metadata: sanitizeAuditPayload(input.metadata),
      },
      select: { id: true, createdAt: true },
    });
  }

  async recordSafely(input: RecordAuditLogInput) {
    try {
      return await this.record(input);
    } catch (error) {
      this.logger.error({
        message: 'Audit log could not be persisted.',
        action: input.action,
        result: input.result,
        errorCode: auditErrorCode(error),
      });
      return null;
    }
  }
}

function sanitizeAuditPayload(value: Record<string, unknown> | undefined) {
  if (!value) return undefined;
  const sanitized = sanitizeLogValue(value);
  const serialized = JSON.stringify(sanitized);
  const sizeBytes = Buffer.byteLength(serialized, 'utf8');
  if (sizeBytes > MAX_AUDIT_JSON_BYTES) {
    return {
      truncated: true,
      originalSizeBytes: sizeBytes,
    } satisfies Prisma.InputJsonObject;
  }
  return JSON.parse(serialized) as Prisma.InputJsonValue;
}

function requireIdentifier(value: string, field: string) {
  const normalized = normalizeIdentifier(value);
  if (!normalized) throw new Error(`Audit ${field} is required.`);
  return normalized;
}

function normalizeIdentifier(value: string | null | undefined) {
  return normalizeText(value, MAX_IDENTIFIER_LENGTH);
}

function normalizeText(
  value: string | null | undefined,
  maximumLength: number,
) {
  const normalized = value?.trim();
  if (!normalized) return null;
  return normalized.slice(0, maximumLength);
}

export function auditErrorCode(error: unknown) {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (
      typeof response === 'object' &&
      response !== null &&
      'code' in response &&
      typeof response.code === 'string'
    ) {
      return response.code.slice(0, MAX_IDENTIFIER_LENGTH);
    }
    return `HTTP_${error.getStatus()}`;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code.slice(0, MAX_IDENTIFIER_LENGTH);
  }
  return error instanceof Error ? error.name : 'UNKNOWN_ERROR';
}

export { AuditActorType, AuditOrigin, AuditResult };
