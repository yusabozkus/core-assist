import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PrismaService } from '../../database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { DataRetentionService } from './data-retention.service';

void test('retention rechecks ticket status and date after selecting a candidate', async () => {
  let selected = false;
  let deleteChecked = false;
  const prisma = {
    auditLog: { findMany: () => Promise.resolve([]) },
    catalogSyncRun: { findMany: () => Promise.resolve([]) },
    contactMessage: { findMany: () => Promise.resolve([]) },
    supportTicket: {
      findMany: ({
        where,
        select,
      }: {
        where: Prisma.SupportTicketWhereInput;
        select: Prisma.SupportTicketSelect;
      }) => {
        assert.deepEqual(
          select,
          { id: true },
          'retention should not read object keys to delete B2 before commit',
        );
        if (where.status !== 'RESOLVED') return Promise.resolve([]);
        selected = true;
        // A concurrent request reopens this ticket after the selection.
        return Promise.resolve([{ id: 'reopened-ticket' }]);
      },
      deleteMany: ({ where }: { where: Prisma.SupportTicketWhereInput }) => {
        assert.ok(selected);
        assert.equal(where.status, 'RESOLVED');
        assert.deepEqual(where.id, { in: ['reopened-ticket'] });
        assert.ok(
          where.resolvedAt &&
            typeof where.resolvedAt === 'object' &&
            'lt' in where.resolvedAt,
        );
        deleteChecked = true;
        return Promise.resolve({ count: 0 });
      },
    },
  };
  const service = new DataRetentionService(prisma as unknown as PrismaService);
  const result = await service.cleanup(new Date('2026-10-06'));
  assert.ok(deleteChecked);
  assert.equal(result.resolvedSupportTickets, 0);
});
