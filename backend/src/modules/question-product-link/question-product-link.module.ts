import { Module } from '@nestjs/common';
import { QuestionProductLinkService } from './question-product-link.service';

@Module({
  providers: [QuestionProductLinkService],
  exports: [QuestionProductLinkService],
})
export class QuestionProductLinkModule {}
