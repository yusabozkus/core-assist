import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import {
  QUESTION_SYNC_DISPATCHER,
  QUESTION_SYNC_QUEUE,
} from './question-sync.constants';
import { QuestionSyncProcessor } from './question-sync.processor';
import { QuestionSyncQueueService } from './question-sync-queue.service';
import { QuestionSyncSchedulerService } from './question-sync-scheduler.service';
import { QuestionSyncWorkerService } from './question-sync-worker.service';

@Module({
  imports: [
    IntegrationsModule,
    BullModule.registerQueue({ name: QUESTION_SYNC_QUEUE }),
  ],
  providers: [
    QuestionSyncQueueService,
    {
      provide: QUESTION_SYNC_DISPATCHER,
      useExisting: QuestionSyncQueueService,
    },
    QuestionSyncWorkerService,
    QuestionSyncProcessor,
    QuestionSyncSchedulerService,
  ],
  exports: [QUESTION_SYNC_DISPATCHER],
})
export class QuestionSyncModule {}
