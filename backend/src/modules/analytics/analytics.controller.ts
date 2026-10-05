import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AnalyticsService } from './analytics.service';
import { AiPerformanceQueryDto } from './dto/ai-performance-query.dto';
import { AiPerformanceDetailQueryDto } from './dto/ai-performance-detail-query.dto';

@Controller('stores/:storeId/analytics')
@UseGuards(AuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('ai/questions')
  findAiPerformanceQuestions(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AiPerformanceDetailQueryDto,
  ) {
    return this.analytics.findAiPerformanceQuestions(storeId, user.id, query);
  }

  @Get('ai')
  findAiPerformance(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AiPerformanceQueryDto,
  ) {
    return this.analytics.findAiPerformance(storeId, user.id, query);
  }
}
