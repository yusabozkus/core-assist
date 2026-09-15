import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuestionSyncModule } from '../question-sync/question-sync.module';
import { QuestionAnswerModule } from '../question-answer/question-answer.module';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { QuestionDraftModule } from './question-draft.module';
import { ProductKnowledgeService } from './product-knowledge.service';
import { ProductKnowledgeController } from './product-knowledge.controller';

@Module({
  imports: [
    AuthModule,
    QuestionSyncModule,
    QuestionAnswerModule,
    QuestionDraftModule,
  ],
  controllers: [QuestionsController, ProductKnowledgeController],
  providers: [QuestionsService, ProductKnowledgeService],
})
export class QuestionsModule {}
