import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AdminActionOriginGuard } from './admin-action-origin.guard';
import { AdminBillingService } from './admin-billing.service';
import { AdminGuard } from './admin.guard';
import { AdminBillingQueryDto } from './dto/admin-billing-query.dto';

@Controller('admin/billing')
@UseGuards(AuthGuard, AdminGuard)
export class AdminBillingController {
  constructor(private readonly billing: AdminBillingService) {}

  @Get()
  findAll(@Query() query: AdminBillingQueryDto) {
    return this.billing.findAll(query);
  }

  @Get(':workspaceId')
  findOne(@Param('workspaceId', new ParseUUIDPipe()) workspaceId: string) {
    return this.billing.findOne(workspaceId);
  }

  @Post(':workspaceId/reconcile')
  @UseGuards(AdminActionOriginGuard)
  reconcile(@Param('workspaceId', new ParseUUIDPipe()) workspaceId: string) {
    return this.billing.reconcile(workspaceId);
  }
}
