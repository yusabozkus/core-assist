import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminActionOriginGuard } from './admin-action-origin.guard';
import { AdminGuard } from './admin.guard';
import { AdminSupportService } from './admin-support.service';
import { AdminSupportAssigneeDto } from './dto/admin-support-assignee.dto';
import { AdminSupportMessageDto } from './dto/admin-support-message.dto';
import { AdminSupportStatusDto } from './dto/admin-support-status.dto';
import { AdminSupportTicketsQueryDto } from './dto/admin-support-tickets-query.dto';

@Controller('admin/support')
@UseGuards(AuthGuard, AdminGuard)
export class AdminSupportController {
  constructor(private readonly support: AdminSupportService) {}

  @Get('agents')
  getAgents() {
    return this.support.getAgents();
  }

  @Get('tickets')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AdminSupportTicketsQueryDto,
  ) {
    return this.support.findAll(query, user.id);
  }

  @Get('tickets/:ticketId')
  findOne(@Param('ticketId', new ParseUUIDPipe()) ticketId: string) {
    return this.support.findOne(ticketId);
  }

  @Post('tickets/:ticketId/messages')
  @UseGuards(AdminActionOriginGuard)
  addMessage(
    @Param('ticketId', new ParseUUIDPipe()) ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AdminSupportMessageDto,
  ) {
    return this.support.addMessage(ticketId, user.id, body);
  }

  @Patch('tickets/:ticketId/status')
  @UseGuards(AdminActionOriginGuard)
  updateStatus(
    @Param('ticketId', new ParseUUIDPipe()) ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AdminSupportStatusDto,
  ) {
    return this.support.updateStatus(ticketId, user.id, body);
  }

  @Patch('tickets/:ticketId/assignee')
  @UseGuards(AdminActionOriginGuard)
  updateAssignee(
    @Param('ticketId', new ParseUUIDPipe()) ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AdminSupportAssigneeDto,
  ) {
    return this.support.updateAssignee(ticketId, user.id, body);
  }
}
