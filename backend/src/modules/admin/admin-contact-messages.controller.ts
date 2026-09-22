import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminActionOriginGuard } from './admin-action-origin.guard';
import { AdminContactMessagesService } from './admin-contact-messages.service';
import { AdminContactMessageStatusDto } from './dto/admin-contact-message-status.dto';
import { AdminContactMessagesQueryDto } from './dto/admin-contact-messages-query.dto';
import { AdminGuard } from './admin.guard';

@Controller('admin/contact-messages')
@UseGuards(AuthGuard, AdminGuard)
export class AdminContactMessagesController {
  constructor(private readonly messages: AdminContactMessagesService) {}

  @Get()
  findAll(@Query() query: AdminContactMessagesQueryDto) {
    return this.messages.findAll(query);
  }

  @Get(':messageId')
  findOne(@Param('messageId', new ParseUUIDPipe()) messageId: string) {
    return this.messages.findOne(messageId);
  }

  @Patch(':messageId/status')
  @UseGuards(AdminActionOriginGuard)
  updateStatus(
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AdminContactMessageStatusDto,
  ) {
    return this.messages.updateStatus(messageId, body.status, user.id);
  }
}
