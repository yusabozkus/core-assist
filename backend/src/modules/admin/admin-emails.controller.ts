import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminEmailsService } from './admin-emails.service';
import { AdminEmailsQueryDto } from './dto/admin-emails-query.dto';

@Controller('admin/emails')
@UseGuards(AuthGuard, AdminGuard)
export class AdminEmailsController {
  constructor(private readonly emails: AdminEmailsService) {}

  @Get()
  findAll(@Query() query: AdminEmailsQueryDto) {
    return this.emails.findAll(query);
  }

  @Get(':emailId')
  findOne(@Param('emailId', new ParseUUIDPipe()) emailId: string) {
    return this.emails.findOne(emailId);
  }

  @Get('recent/:workspaceId')
  recent(@Param('workspaceId', new ParseUUIDPipe()) workspaceId: string) {
    return this.emails.recentForWorkspace(workspaceId);
  }
}
