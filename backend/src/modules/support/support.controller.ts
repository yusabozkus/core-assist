import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateSupportMessageDto } from './dto/create-support-message.dto';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { UpdateSupportTicketStatusDto } from './dto/update-support-ticket-status.dto';
import { SupportService } from './support.service';

@Controller('stores/:storeId/support/tickets')
@UseGuards(AuthGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  findAll(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.support.findAll(storeId, user.id);
  }

  @Post()
  create(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateSupportTicketDto,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    return this.support.create(storeId, user.id, body, userAgent);
  }

  @Get(':ticketId')
  findOne(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('ticketId', new ParseUUIDPipe()) ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.support.findOne(storeId, ticketId, user.id);
  }

  @Post(':ticketId/messages')
  reply(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('ticketId', new ParseUUIDPipe()) ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateSupportMessageDto,
  ) {
    return this.support.reply(storeId, ticketId, user.id, body);
  }

  @Patch(':ticketId/status')
  updateStatus(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('ticketId', new ParseUUIDPipe()) ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateSupportTicketStatusDto,
  ) {
    return this.support.updateStatus(storeId, ticketId, user.id, body);
  }
}
