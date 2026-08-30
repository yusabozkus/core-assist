import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuestionSyncModule } from '../question-sync/question-sync.module';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';

@Module({
  imports: [AuthModule, QuestionSyncModule],
  controllers: [QuestionsController],
  providers: [QuestionsService],
})
export class QuestionsModule {}
