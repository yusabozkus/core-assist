import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
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
import { AdminSupportImageMessageDto } from '../support/dto/support-image-message.dto';
import { SupportImageRateLimitGuard } from '../support/support-image-rate-limit.guard';
import {
  MAX_SUPPORT_IMAGE_BYTES,
  MAX_SUPPORT_IMAGES,
} from '../support/support-attachment.service';

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

  @Post('tickets/:ticketId/image-messages')
  @UseGuards(AdminActionOriginGuard, SupportImageRateLimitGuard)
  @UseInterceptors(
    FilesInterceptor('images', MAX_SUPPORT_IMAGES, {
      limits: {
        fileSize: MAX_SUPPORT_IMAGE_BYTES,
        files: MAX_SUPPORT_IMAGES,
        fields: 2,
        parts: 5,
        fieldSize: 10 * 1024,
      },
    }),
  )
  addImageMessage(
    @Param('ticketId', new ParseUUIDPipe()) ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AdminSupportImageMessageDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.support.addMessageWithImages(
      ticketId,
      user.id,
      {
        message: body.message ?? '',
        visibility: body.visibility,
      },
      files,
    );
  }

  @Get('tickets/:ticketId/attachments/:attachmentId')
  async readAttachment(
    @Param('ticketId', new ParseUUIDPipe()) ticketId: string,
    @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string,
    @Res() response: Response,
  ) {
    const image = await this.support.readAttachment(ticketId, attachmentId);
    response.setHeader('Content-Type', image.contentType);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.end(image.bytes);
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
