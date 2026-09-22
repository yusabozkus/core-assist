import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { AdminGlobalSearchQueryDto } from './dto/admin-global-search-query.dto';

const syncSearchSelect = {
  id: true,
  kind: true,
  status: true,
  startedAt: true,
  connection: {
    select: {
      providerKey: true,
      store: {
        select: {
          name: true,
          workspace: { select: { id: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.CatalogSyncRunSelect;

type SyncSearchRecord = Prisma.CatalogSyncRunGetPayload<{
  select: typeof syncSearchSelect;
}>;

type PaddleReferenceKind =
  'CUSTOMER' | 'SUBSCRIPTION' | 'TRANSACTION' | 'PRICE';

type PaddleReferenceCandidate = {
  kind: PaddleReferenceKind;
  value: string | null;
};

type PaddleSearchResult = {
  id: string;
  kind: PaddleReferenceKind;
  reference: string;
  workspaceId: string;
  workspaceName: string;
  ownerEmail: string;
  plan: string | null;
  status: string;
  updatedAt: Date;
};

@Injectable()
export class AdminGlobalSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: AdminGlobalSearchQueryDto) {
    const text = query.query;
    const limit = query.limit;
    const contains = { contains: text, mode: 'insensitive' as const };
    const startsWith = { startsWith: text, mode: 'insensitive' as const };
    const ticketNumber = parseTicketNumber(text);
    const memberMatch = {
      OR: [{ name: contains }, { email: contains }],
    };

    const [
      accounts,
      stores,
      tickets,
      syncRuns,
      subscriptions,
      checkouts,
      planChanges,
      transactionReferences,
    ] = await Promise.all([
      this.prisma.workspace.findMany({
        where: {
          OR: [
            { id: startsWith },
            { name: contains },
            { owner: { is: memberMatch } },
            { members: { some: { user: { is: memberMatch } } } },
          ],
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: limit,
        select: {
          id: true,
          name: true,
          owner: { select: { name: true, email: true } },
          members: {
            where: { user: { is: memberMatch } },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { user: { select: { name: true, email: true } } },
          },
          _count: { select: { stores: true } },
        },
      }),
      this.prisma.store.findMany({
        where: { OR: [{ id: startsWith }, { name: contains }] },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: limit,
        select: {
          id: true,
          name: true,
          status: true,
          workspace: {
            select: {
              id: true,
              name: true,
              owner: { select: { email: true } },
            },
          },
        },
      }),
      this.prisma.supportTicket.findMany({
        where: {
          OR: [
            { id: startsWith },
            ...(ticketNumber === null ? [] : [{ number: ticketNumber }]),
            { subject: contains },
            { createdBy: { is: { email: contains } } },
          ],
        },
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'asc' }],
        take: limit,
        select: {
          id: true,
          number: true,
          subject: true,
          status: true,
          createdAt: true,
          workspace: { select: { id: true, name: true } },
          store: { select: { name: true } },
        },
      }),
      text.length >= 6
        ? this.prisma.catalogSyncRun.findMany({
            where: { id: startsWith },
            orderBy: [{ startedAt: 'desc' }, { id: 'asc' }],
            take: limit,
            select: syncSearchSelect,
          })
        : Promise.resolve([] as SyncSearchRecord[]),
      this.prisma.billingSubscription.findMany({
        where: {
          OR: [
            { paddleCustomerId: startsWith },
            { paddleSubscriptionId: startsWith },
            { paddlePriceId: startsWith },
          ],
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: limit,
        select: {
          id: true,
          plan: true,
          status: true,
          paddleCustomerId: true,
          paddleSubscriptionId: true,
          paddlePriceId: true,
          updatedAt: true,
          workspace: {
            select: {
              id: true,
              name: true,
              owner: { select: { email: true } },
            },
          },
        },
      }),
      this.prisma.billingCheckout.findMany({
        where: {
          OR: [
            { paddleTransactionId: startsWith },
            { expectedPaddleCustomerId: startsWith },
            { paddleSubscriptionId: startsWith },
            { previousPaddleSubscriptionId: startsWith },
            { paddlePriceId: startsWith },
          ],
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: limit,
        select: {
          id: true,
          plan: true,
          status: true,
          paddleTransactionId: true,
          expectedPaddleCustomerId: true,
          paddleSubscriptionId: true,
          previousPaddleSubscriptionId: true,
          paddlePriceId: true,
          updatedAt: true,
          workspace: {
            select: {
              id: true,
              name: true,
              owner: { select: { email: true } },
            },
          },
        },
      }),
      this.prisma.billingPlanChange.findMany({
        where: {
          OR: [
            { paddleCustomerId: startsWith },
            { paddleSubscriptionId: startsWith },
            { sourcePriceId: startsWith },
            { targetPriceId: startsWith },
          ],
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: limit,
        select: {
          id: true,
          plan: true,
          status: true,
          paddleCustomerId: true,
          paddleSubscriptionId: true,
          sourcePriceId: true,
          targetPriceId: true,
          updatedAt: true,
          workspace: {
            select: {
              id: true,
              name: true,
              owner: { select: { email: true } },
            },
          },
        },
      }),
      this.prisma.billingTransactionReference.findMany({
        where: {
          OR: [
            { paddleTransactionId: startsWith },
            { paddleSubscriptionId: startsWith },
            { paddleCustomerId: startsWith },
          ],
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: limit,
        select: {
          id: true,
          paddleTransactionId: true,
          paddleSubscriptionId: true,
          paddleCustomerId: true,
          updatedAt: true,
          workspace: {
            select: {
              id: true,
              name: true,
              owner: { select: { email: true } },
              billingSubscription: {
                select: { plan: true, status: true },
              },
            },
          },
        },
      }),
    ]);

    const paddleRecords = new Map<string, PaddleSearchResult>();
    for (const subscription of subscriptions) {
      addPaddleResult(
        paddleRecords,
        subscription.id,
        text,
        [
          { kind: 'CUSTOMER', value: subscription.paddleCustomerId },
          { kind: 'SUBSCRIPTION', value: subscription.paddleSubscriptionId },
          { kind: 'PRICE', value: subscription.paddlePriceId },
        ],
        subscription,
      );
    }
    for (const checkout of checkouts) {
      addPaddleResult(
        paddleRecords,
        checkout.id,
        text,
        [
          { kind: 'TRANSACTION', value: checkout.paddleTransactionId },
          { kind: 'CUSTOMER', value: checkout.expectedPaddleCustomerId },
          { kind: 'SUBSCRIPTION', value: checkout.paddleSubscriptionId },
          {
            kind: 'SUBSCRIPTION',
            value: checkout.previousPaddleSubscriptionId,
          },
          { kind: 'PRICE', value: checkout.paddlePriceId },
        ],
        checkout,
      );
    }
    for (const change of planChanges) {
      addPaddleResult(
        paddleRecords,
        change.id,
        text,
        [
          { kind: 'CUSTOMER', value: change.paddleCustomerId },
          { kind: 'SUBSCRIPTION', value: change.paddleSubscriptionId },
          { kind: 'PRICE', value: change.sourcePriceId },
          { kind: 'PRICE', value: change.targetPriceId },
        ],
        change,
      );
    }
    for (const reference of transactionReferences) {
      addPaddleResult(
        paddleRecords,
        reference.id,
        text,
        [
          { kind: 'TRANSACTION', value: reference.paddleTransactionId },
          { kind: 'SUBSCRIPTION', value: reference.paddleSubscriptionId },
          { kind: 'CUSTOMER', value: reference.paddleCustomerId },
        ],
        {
          plan: reference.workspace.billingSubscription?.plan ?? null,
          status: reference.workspace.billingSubscription?.status ?? 'UNKNOWN',
          updatedAt: reference.updatedAt,
          workspace: reference.workspace,
        },
      );
    }

    return {
      query: text,
      accounts: accounts.map((account) => ({
        id: account.id,
        name: account.name,
        ownerName: account.owner.name,
        ownerEmail: account.owner.email,
        matchedMember: account.members[0]?.user ?? null,
        storeCount: account._count.stores,
      })),
      stores: stores.map((store) => ({
        id: store.id,
        name: store.name,
        status: store.status,
        workspaceId: store.workspace.id,
        workspaceName: store.workspace.name,
        ownerEmail: store.workspace.owner.email,
      })),
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        code: formatTicketCode(ticket.number, ticket.createdAt),
        subject: ticket.subject,
        status: ticket.status,
        workspaceId: ticket.workspace.id,
        workspaceName: ticket.workspace.name,
        storeName: ticket.store?.name ?? null,
      })),
      syncRuns: syncRuns.map((run) => ({
        id: run.id,
        kind: run.kind,
        status: run.status,
        providerKey: run.connection.providerKey,
        storeName: run.connection.store.name,
        workspaceId: run.connection.store.workspace.id,
        workspaceName: run.connection.store.workspace.name,
        startedAt: run.startedAt,
      })),
      paddleRecords: [...paddleRecords.values()]
        .sort(
          (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
        )
        .slice(0, limit),
    };
  }
}

function addPaddleResult(
  results: Map<string, PaddleSearchResult>,
  recordId: string,
  query: string,
  candidates: PaddleReferenceCandidate[],
  record: {
    plan: string | null;
    status: string;
    updatedAt: Date;
    workspace: { id: string; name: string; owner: { email: string } };
  },
) {
  const normalizedQuery = query.toLocaleLowerCase('en-US');
  const match = candidates.find((candidate) =>
    candidate.value?.toLocaleLowerCase('en-US').startsWith(normalizedQuery),
  );
  if (!match?.value) return;

  const key = `${record.workspace.id}:${match.value}`;
  const existing = results.get(key);
  if (existing && existing.updatedAt >= record.updatedAt) return;

  results.set(key, {
    id: `${match.kind}:${recordId}`,
    kind: match.kind,
    reference: match.value,
    workspaceId: record.workspace.id,
    workspaceName: record.workspace.name,
    ownerEmail: record.workspace.owner.email,
    plan: record.plan,
    status: record.status,
    updatedAt: record.updatedAt,
  });
}

function parseTicketNumber(value: string) {
  const normalized = value.trim();
  const match =
    normalized.match(/^#?(\d{1,10})$/) ??
    normalized.match(/^CA-\d{4}-(\d{1,10})$/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function formatTicketCode(number: number, createdAt: Date) {
  return `CA-${createdAt.getUTCFullYear()}-${String(number).padStart(6, '0')}`;
}
