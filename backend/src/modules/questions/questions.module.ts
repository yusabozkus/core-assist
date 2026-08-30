import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuestionSyncModule } from '../question-sync/question-sync.module';
import { QuestionAnswerModule } from '../question-answer/question-answer.module';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { ProductAnswerContextService } from './product-answer-context.service';
import { QuestionDraftService } from './question-draft.service';

@Module({
  imports: [AuthModule, QuestionSyncModule, QuestionAnswerModule],
  controllers: [QuestionsController],
  providers: [
    QuestionsService,
    ProductAnswerContextService,
    QuestionDraftService,
  ],
})
export class QuestionsModule {}
