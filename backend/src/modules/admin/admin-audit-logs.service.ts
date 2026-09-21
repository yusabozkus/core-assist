import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { AuditActorType, AuditResult } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import {
  AdminAuditLogsQueryDto,
  AdminAuditOrder,
  AdminAuditPeriod,
} from './dto/admin-audit-logs-query.dto';

const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class AdminAuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminAuditLogsQueryDto) {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - DAY);
    const where = buildWhere(query, now);
    const orderDirection =
      query.order === AdminAuditOrder.OLDEST ? 'asc' : 'desc';

    const [logs, total, all, lastDay, failuresLastDay, adminLastDay, actions] =
      await Promise.all([
        this.prisma.auditLog.findMany({
          where,
          orderBy: [{ createdAt: orderDirection }, { id: orderDirection }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        this.prisma.auditLog.count({ where }),
        this.prisma.auditLog.count(),
        this.prisma.auditLog.count({ where: { createdAt: { gte: dayAgo } } }),
        this.prisma.auditLog.count({
          where: {
            createdAt: { gte: dayAgo },
            result: AuditResult.FAILURE,
          },
        }),
        this.prisma.auditLog.count({
          where: {
            createdAt: { gte: dayAgo },
            actorType: AuditActorType.ADMIN,
          },
        }),
        this.prisma.auditLog.findMany({
          distinct: ['action'],
          orderBy: { action: 'asc' },
          select: { action: true },
        }),
      ]);

    const workspaceIds = unique(logs.map((log) => log.workspaceId));
    const storeIds = unique(logs.map((log) => log.storeId));
    const workspaceQuery: Promise<Array<{ id: string; name: string }>> =
      workspaceIds.length
        ? this.prisma.workspace.findMany({
            where: { id: { in: workspaceIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]);
    const storeQuery: Promise<Array<{ id: string; name: string }>> =
      storeIds.length
        ? this.prisma.store.findMany({
            where: { id: { in: storeIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]);
    const [workspaces, stores] = await Promise.all([
      workspaceQuery,
      storeQuery,
    ]);

    const workspaceById = new Map(
      workspaces.map((workspace) => [workspace.id, workspace]),
    );
    const storeById = new Map(stores.map((store) => [store.id, store]));

    return {
      items: logs.map((log) => ({
        ...log,
        actor:
          log.actorUserId || log.actorName || log.actorEmail
            ? {
                id: log.actorUserId,
                name: log.actorName ?? '',
                email: log.actorEmail ?? '',
              }
            : null,
        workspace: log.workspaceId
          ? (workspaceById.get(log.workspaceId) ?? null)
          : null,
        store: log.storeId ? (storeById.get(log.storeId) ?? null) : null,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
      summary: {
        total: all,
        last24Hours: lastDay,
        failuresLast24Hours: failuresLastDay,
        adminActionsLast24Hours: adminLastDay,
      },
      actions: actions.map((row) => row.action),
      generatedAt: now,
    };
  }
}

function buildWhere(
  query: AdminAuditLogsQueryDto,
  now: Date,
): Prisma.AuditLogWhereInput {
  const conditions: Prisma.AuditLogWhereInput[] = [];
  if (query.q) {
    conditions.push({
      OR: [
        { id: { contains: query.q, mode: 'insensitive' } },
        { action: { contains: query.q, mode: 'insensitive' } },
        { actorUserId: { contains: query.q, mode: 'insensitive' } },
        { actorName: { contains: query.q, mode: 'insensitive' } },
        { actorEmail: { contains: query.q, mode: 'insensitive' } },
        { workspaceId: { contains: query.q, mode: 'insensitive' } },
        { storeId: { contains: query.q, mode: 'insensitive' } },
        { targetType: { contains: query.q, mode: 'insensitive' } },
        { targetId: { contains: query.q, mode: 'insensitive' } },
        { requestId: { contains: query.q, mode: 'insensitive' } },
        { errorCode: { contains: query.q, mode: 'insensitive' } },
      ],
    });
  }
  if (query.actorType) conditions.push({ actorType: query.actorType });
  if (query.origin) conditions.push({ origin: query.origin });
  if (query.result) conditions.push({ result: query.result });
  if (query.action) conditions.push({ action: query.action });
  const periodStart = resolvePeriodStart(query.period, now);
  if (periodStart) conditions.push({ createdAt: { gte: periodStart } });
  return conditions.length ? { AND: conditions } : {};
}

function resolvePeriodStart(period: AdminAuditPeriod | undefined, now: Date) {
  if (period === AdminAuditPeriod.DAY) return new Date(now.getTime() - DAY);
  if (period === AdminAuditPeriod.WEEK)
    return new Date(now.getTime() - 7 * DAY);
  if (period === AdminAuditPeriod.MONTH)
    return new Date(now.getTime() - 30 * DAY);
  return null;
}

function unique(values: Array<string | null>) {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}
