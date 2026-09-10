import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  ChannelConnectionStatus,
  ChannelType,
  StoreStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { activeBillingSubscriptionWhere } from '../billing/billing-access.policy';
import {
  DEFAULT_QUESTION_SYNC_INTERVAL_MS,
  QUESTION_SYNC_QUEUE,
  SCHEDULE_CONNECTED_QUESTIONS_JOB,
} from './question-sync.constants';
import { QuestionSyncQueueService } from './question-sync-queue.service';

const QUESTION_SCHEDULER_JOB_ID = 'connected-question-sync-scheduler';

@Injectable()
export class QuestionSyncSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(QuestionSyncSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly questionSyncQueue: QuestionSyncQueueService,
    @InjectQueue(QUESTION_SYNC_QUEUE)
    private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    await this.queue.upsertJobScheduler(
      QUESTION_SCHEDULER_JOB_ID,
      { every: getQuestionSyncInterval() },
      {
        name: SCHEDULE_CONNECTED_QUESTIONS_JOB,
        data: {},
        opts: {
          removeOnComplete: true,
          removeOnFail: { count: 25 },
        },
      },
    );
  }

  async dispatchConnectedQuestionSyncs() {
    const connections = await this.prisma.channelConnection.findMany({
      where: {
        type: ChannelType.COMMERCE,
        status: ChannelConnectionStatus.CONNECTED,
        credentialsEncrypted: { not: null },
        store: {
          status: StoreStatus.ACTIVE,
          workspace: {
            billingSubscription: { is: activeBillingSubscriptionWhere() },
          },
        },
      },
      select: { id: true, storeId: true },
    });
    const results = await Promise.allSettled(
      connections.map((connection) =>
        this.questionSyncQueue.enqueue(connection.storeId, connection.id, {
          trigger: 'SCHEDULED',
        }),
      ),
    );
    const failedCount = results.filter(
      (result) => result.status === 'rejected',
    ).length;

    if (failedCount > 0 && failedCount !== connections.length) {
      this.logger.warn(
        `${failedCount} question sync job could not be queued; locked connections are skipped.`,
      );
    }
  }
}

function getQuestionSyncInterval() {
  const configured = Number(process.env.QUESTION_SYNC_INTERVAL_MS);

  if (Number.isFinite(configured) && configured >= 60_000) {
    return Math.trunc(configured);
  }

  return DEFAULT_QUESTION_SYNC_INTERVAL_MS;
}
