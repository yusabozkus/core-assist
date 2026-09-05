import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { InventoryVerificationModule } from '../inventory-verification/inventory-verification.module';
import {
  QUESTION_ANSWER_DISPATCHER,
  QUESTION_ANSWER_QUEUE,
} from './question-answer.constants';
import { QuestionAnswerProcessor } from './question-answer.processor';
import { QuestionAnswerQueueService } from './question-answer-queue.service';
import { QuestionAnswerWorkerService } from './question-answer-worker.service';

@Module({
  imports: [
    IntegrationsModule,
    InventoryVerificationModule,
    BullModule.registerQueue({ name: QUESTION_ANSWER_QUEUE }),
  ],
  providers: [
    QuestionAnswerQueueService,
    {
      provide: QUESTION_ANSWER_DISPATCHER,
      useExisting: QuestionAnswerQueueService,
    },
    QuestionAnswerWorkerService,
    QuestionAnswerProcessor,
  ],
  exports: [QUESTION_ANSWER_DISPATCHER],
})
export class QuestionAnswerModule {}
