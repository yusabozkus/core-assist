import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { QuestionReplyDecisionService } from '../questions/question-reply-decision.service';
import { LandingDemoController } from './landing-demo.controller';
import { LandingDemoService } from './landing-demo.service';

@Module({
  imports: [AiModule],
  controllers: [LandingDemoController],
  providers: [LandingDemoService, QuestionReplyDecisionService],
})
export class LandingDemoModule {}
