import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AiTestService } from './ai-test.service';
import { AiTestQuestionDto } from './dto/ai-test-question.dto';

@Controller('stores/:storeId/ai-test')
@UseGuards(AuthGuard)
export class AiTestController {
  constructor(private readonly aiTest: AiTestService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  answer(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AiTestQuestionDto,
  ) {
    return this.aiTest.answer(storeId, user.id, body);
  }
}
