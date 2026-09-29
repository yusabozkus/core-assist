import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SetupGuideService } from './setup-guide.service';

function createFixture() {
  const member = {
    id: 'member-id',
    setupGuidePhase: 'ESSENTIAL',
    setupGuideAiSettingsVisitedAt: null as Date | null,
    setupGuideChannelsVisitedAt: null as Date | null,
    setupGuideTeamVisitedAt: null as Date | null,
    setupGuideFaqSkippedAt: null as Date | null,
  };
  const prisma = {
    storeMember: {
      findFirst: ({ where }: { where: { storeId: string; userId: string } }) =>
        Promise.resolve(
          where.storeId === 'own-store' && where.userId === 'owner'
            ? { ...member }
            : null,
        ),
      updateMany: ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        if (
          where.id !== member.id ||
          (where.setupGuidePhase !== undefined &&
            where.setupGuidePhase !== member.setupGuidePhase) ||
          (where.setupGuideAiSettingsVisitedAt === null &&
            member.setupGuideAiSettingsVisitedAt !== null) ||
          (where.setupGuideChannelsVisitedAt === null &&
            member.setupGuideChannelsVisitedAt !== null) ||
          (where.setupGuideTeamVisitedAt === null &&
            member.setupGuideTeamVisitedAt !== null) ||
          (where.setupGuideFaqSkippedAt === null &&
            member.setupGuideFaqSkippedAt !== null)
        ) {
          return Promise.resolve({ count: 0 });
        }
        Object.assign(member, data);
        return Promise.resolve({ count: 1 });
      },
      update: ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(member, data);
        return Promise.resolve({ ...member });
      },
    },
  };
  return {
    member,
    service: new SetupGuideService(prisma as unknown as PrismaService),
  };
}

void test('guide state is scoped to the authenticated store member', async () => {
  const { service } = createFixture();
  await assert.rejects(service.get('other-store', 'owner'), NotFoundException);
  await assert.rejects(
    service.update('own-store', 'other-user', { action: 'FINISH' }),
    NotFoundException,
  );
});

void test('completion stays done when an older browser imports stale progress', async () => {
  const { service } = createFixture();
  await service.update('own-store', 'owner', { action: 'VISIT_AI' });
  await service.update('own-store', 'owner', { action: 'CONTINUE_OPTIONAL' });
  const finished = await service.update('own-store', 'owner', {
    action: 'FINISH',
  });
  assert.deepEqual(finished, {
    phase: 'done',
    aiSettingsVisited: true,
    channelsVisited: false,
    teamVisited: false,
    skippedFaq: false,
  });

  const afterLegacyImport = await service.update('own-store', 'owner', {
    action: 'IMPORT_LEGACY',
    phase: 'optional',
    aiSettingsVisited: false,
    skippedFaq: true,
  });
  assert.equal(afterLegacyImport.phase, 'done');
  assert.equal(afterLegacyImport.skippedFaq, true);
});

void test('channel and team visits persist for the same member', async () => {
  const { service } = createFixture();
  await service.update('own-store', 'owner', { action: 'CONTINUE_OPTIONAL' });
  const afterChannels = await service.update('own-store', 'owner', {
    action: 'VISIT_CHANNELS',
  });
  assert.equal(afterChannels.channelsVisited, true);
  assert.equal(afterChannels.teamVisited, false);
  const afterTeam = await service.update('own-store', 'owner', {
    action: 'VISIT_TEAM',
  });
  assert.equal(afterTeam.channelsVisited, true);
  assert.equal(afterTeam.teamVisited, true);
});
