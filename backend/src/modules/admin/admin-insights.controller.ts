import {
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AdminAiUsageService } from './admin-ai-usage.service';
import { AdminGuard } from './admin.guard';
import { AdminSystemHealthService } from './admin-system-health.service';
import { AdminAiUsageQueryDto } from './dto/admin-ai-usage-query.dto';
import {
  AdminAiBlockerType,
  AdminAiBlockersQueryDto,
} from './dto/admin-ai-blockers-query.dto';

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminInsightsController {
  constructor(
    private readonly aiUsage: AdminAiUsageService,
    private readonly systemHealth: AdminSystemHealthService,
  ) {}

  @Get('ai-usage')
  getAiUsage(@Query() query: AdminAiUsageQueryDto) {
    return this.aiUsage.getUsage(query);
  }

  @Get('ai-usage/blockers/:type')
  getAiUsageBlockers(
    @Param('type', new ParseEnumPipe(AdminAiBlockerType))
    type: AdminAiBlockerType,
    @Query() query: AdminAiBlockersQueryDto,
  ) {
    return this.aiUsage.getBlockers(type, query);
  }

  @Get('system-health')
  getSystemHealth() {
    return this.systemHealth.getHealth();
  }
}
