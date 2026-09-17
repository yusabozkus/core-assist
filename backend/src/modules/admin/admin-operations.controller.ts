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
import { AdminActionOriginGuard } from './admin-action-origin.guard';
import { AdminGuard } from './admin.guard';
import { AdminOperationsService } from './admin-operations.service';
import { AdminOperationsQueryDto } from './dto/admin-operations-query.dto';

@Controller('admin/operations')
@UseGuards(AuthGuard, AdminGuard)
export class AdminOperationsController {
  constructor(private readonly operations: AdminOperationsService) {}

  @Get()
  findAll(@Query() query: AdminOperationsQueryDto) {
    return this.operations.findAll(query);
  }

  @Post('sync-runs/:syncRunId/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AdminActionOriginGuard)
  retrySyncRun(@Param('syncRunId', new ParseUUIDPipe()) syncRunId: string) {
    return this.operations.retrySyncRun(syncRunId);
  }
}
