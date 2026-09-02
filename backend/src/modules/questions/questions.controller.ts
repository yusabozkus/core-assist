import {
  Controller,
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { QuestionsService } from './questions.service';
import { AnswerProductQuestionDto } from './dto/answer-product-question.dto';
import { QuestionListQueryDto } from './dto/question-list-query.dto';

@Controller('stores/:storeId/questions')
@UseGuards(AuthGuard)
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get()
  findAll(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QuestionListQueryDto,
  ) {
    return this.questionsService.findAll(storeId, user.id, query);
  }

  @Post('sync')
  @HttpCode(HttpStatus.ACCEPTED)
  sync(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.questionsService.sync(storeId, user.id);
  }

  @Post(':questionId/answer')
  @HttpCode(HttpStatus.ACCEPTED)
  answer(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @Body() body: AnswerProductQuestionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.questionsService.answer(
      storeId,
      questionId,
      user.id,
      body.answer,
    );
  }

  @Post(':questionId/draft')
  @HttpCode(HttpStatus.OK)
  draft(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.questionsService.draft(storeId, questionId, user.id);
  }
}
