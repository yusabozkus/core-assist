import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AdminAuditLogsService } from './admin-audit-logs.service';
import { AdminGuard } from './admin.guard';
import { AdminAuditLogsQueryDto } from './dto/admin-audit-logs-query.dto';

@Controller('admin/audit-logs')
@UseGuards(AuthGuard, AdminGuard)
export class AdminAuditLogsController {
  constructor(private readonly auditLogs: AdminAuditLogsService) {}

  @Get()
  findAll(@Query() query: AdminAuditLogsQueryDto) {
    return this.auditLogs.findAll(query);
  }
}
