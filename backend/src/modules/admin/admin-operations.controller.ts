import {
  Controller,
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
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminActionOriginGuard } from './admin-action-origin.guard';
import { AdminGuard } from './admin.guard';
import { AdminOperationsService } from './admin-operations.service';
import {
  AdminOperationsQueryDto,
  AdminQueueFailuresQueryDto,
} from './dto/admin-operations-query.dto';

@Controller('admin/operations')
@UseGuards(AuthGuard, AdminGuard)
export class AdminOperationsController {
  constructor(private readonly operations: AdminOperationsService) {}

  @Get()
  findAll(@Query() query: AdminOperationsQueryDto) {
    return this.operations.findAll(query);
  }

  @Get('queues/:queueKey')
  findQueueFailures(
    @Param('queueKey') queueKey: string,
    @Query() query: AdminQueueFailuresQueryDto,
  ) {
    return this.operations.findQueueFailures(queueKey, query);
  }

  @Post('sync-runs/:syncRunId/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AdminActionOriginGuard)
  retrySyncRun(
    @Param('syncRunId', new ParseUUIDPipe()) syncRunId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.operations.retrySyncRun(syncRunId, user.id);
  }
}
