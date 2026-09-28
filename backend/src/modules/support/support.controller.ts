import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AdminActionOriginGuard } from '../admin/admin-action-origin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateSupportMessageDto } from './dto/create-support-message.dto';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { UpdateSupportTicketStatusDto } from './dto/update-support-ticket-status.dto';
import { SupportService } from './support.service';
import {
  MAX_SUPPORT_IMAGE_BYTES,
  MAX_SUPPORT_IMAGES,
} from './support-attachment.service';
import { SupportImageMessageDto } from './dto/support-image-message.dto';
import { SupportImageRateLimitGuard } from './support-image-rate-limit.guard';

@Controller('support/tickets')
@UseGuards(AuthGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.support.findAll(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateSupportTicketDto,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    return this.support.create(user.id, body, userAgent);
  }

  @Get(':ticketId')
  findOne(
    @Param('ticketId', new ParseUUIDPipe()) ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.support.findOne(ticketId, user.id);
  }

  @Post(':ticketId/messages')
  reply(
    @Param('ticketId', new ParseUUIDPipe()) ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateSupportMessageDto,
  ) {
    return this.support.reply(ticketId, user.id, body);
  }

  @Post(':ticketId/image-messages')
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
  replyWithImages(
    @Param('ticketId', new ParseUUIDPipe()) ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SupportImageMessageDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.support.replyWithImages(ticketId, user.id, body.message, files);
  }

  @Get(':ticketId/attachments/:attachmentId')
  async readAttachment(
    @Param('ticketId', new ParseUUIDPipe()) ticketId: string,
    @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const image = await this.support.readAttachment(
      ticketId,
      attachmentId,
      user.id,
    );
    response.setHeader('Content-Type', image.contentType);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.end(image.bytes);
  }

  @Patch(':ticketId/status')
  updateStatus(
    @Param('ticketId', new ParseUUIDPipe()) ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateSupportTicketStatusDto,
  ) {
    return this.support.updateStatus(ticketId, user.id, body);
  }
}
