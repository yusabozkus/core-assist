import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { QuestionSyncModule } from '../question-sync/question-sync.module';
import { QuestionAnswerModule } from '../question-answer/question-answer.module';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { ProductAnswerContextService } from './product-answer-context.service';
import { QuestionDraftService } from './question-draft.service';
import { QuestionResponsePolicyService } from './question-response-policy.service';
import { QuestionReplyDecisionService } from './question-reply-decision.service';

@Module({
  imports: [AuthModule, QuestionSyncModule, QuestionAnswerModule, AiModule],
  controllers: [QuestionsController],
  providers: [
    QuestionsService,
    ProductAnswerContextService,
    QuestionDraftService,
    QuestionResponsePolicyService,
    QuestionReplyDecisionService,
  ],
})
export class QuestionsModule {}
