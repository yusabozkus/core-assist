import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuestionDraftModule } from '../questions/question-draft.module';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';

@Module({
  imports: [AuthModule, QuestionDraftModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
