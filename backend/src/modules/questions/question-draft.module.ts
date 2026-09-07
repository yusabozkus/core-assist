import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { InventoryVerificationModule } from '../inventory-verification/inventory-verification.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QuestionAnswerModule } from '../question-answer/question-answer.module';
import { QuestionProductLinkModule } from '../question-product-link/question-product-link.module';
import {
  QUESTION_DRAFT_DISPATCHER,
  QUESTION_DRAFT_QUEUE,
} from './question-draft.constants';
import { QuestionDraftProcessor } from './question-draft.processor';
import { QuestionDraftQueueService } from './question-draft-queue.service';
import { QuestionDraftWorkerService } from './question-draft-worker.service';
import { ProductAnswerContextService } from './product-answer-context.service';
import { QuestionDraftService } from './question-draft.service';
import { QuestionReplyDecisionService } from './question-reply-decision.service';
import { QuestionResponsePolicyService } from './question-response-policy.service';

@Module({
  imports: [
    AiModule,
    InventoryVerificationModule,
    NotificationsModule,
    QuestionAnswerModule,
    QuestionProductLinkModule,
    BullModule.registerQueue({ name: QUESTION_DRAFT_QUEUE }),
  ],
  providers: [
    ProductAnswerContextService,
    QuestionDraftService,
    QuestionResponsePolicyService,
    QuestionReplyDecisionService,
    QuestionDraftQueueService,
    {
      provide: QUESTION_DRAFT_DISPATCHER,
      useExisting: QuestionDraftQueueService,
    },
    QuestionDraftWorkerService,
    QuestionDraftProcessor,
  ],
  exports: [QuestionDraftService, QUESTION_DRAFT_DISPATCHER],
})
export class QuestionDraftModule {}
