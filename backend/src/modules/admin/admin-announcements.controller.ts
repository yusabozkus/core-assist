import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminGuard } from './admin.guard';
import { AdminActionOriginGuard } from './admin-action-origin.guard';
import { AdminAnnouncementsService } from './admin-announcements.service';
import { PreviewAdminAnnouncementDto } from './dto/admin-announcement.dto';

@Controller('admin/announcements')
@UseGuards(AuthGuard, AdminGuard)
export class AdminAnnouncementsController {
  constructor(private readonly announcements: AdminAnnouncementsService) {}

  @Get()
  list() {
    return this.announcements.list();
  }

  @Post('preview')
  @UseGuards(AdminActionOriginGuard)
  preview(
    @Body() body: PreviewAdminAnnouncementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.announcements.preview(body, user.id);
  }

  @Post(':id/publish')
  @HttpCode(200)
  @UseGuards(AdminActionOriginGuard)
  publish(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.announcements.publish(id, user.id);
  }
}
