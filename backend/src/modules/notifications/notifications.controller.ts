import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { MarkAllNotificationsReadDto } from './dto/mark-all-notifications-read.dto';
import { NotificationStoreQueryDto } from './dto/notification-store-query.dto';
import { NotificationStreamQueryDto } from './dto/notification-stream-query.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { UpdateNotificationDeliverySettingsDto } from './dto/update-notification-delivery-settings.dto';
import {
  RemoveWebPushSubscriptionDto,
  SaveWebPushSubscriptionDto,
} from './dto/web-push-subscription.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('preferences')
  getPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationStoreQueryDto,
  ) {
    return this.notifications.getPreferences(user.id, query.storeId);
  }

  @Sse('stream')
  stream(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationStreamQueryDto,
  ) {
    return this.notifications.stream(user.id, query.storeId);
  }

  @Patch('preferences')
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateNotificationPreferencesDto,
  ) {
    return this.notifications.updatePreferences(user.id, body);
  }

  @Get('delivery-settings')
  getDeliverySettings(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationStoreQueryDto,
  ) {
    return this.notifications.getDeliverySettings(user.id, query.storeId);
  }

  @Patch('delivery-settings')
  updateDeliverySettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateNotificationDeliverySettingsDto,
  ) {
    return this.notifications.updateDeliverySettings(user.id, body);
  }

  @Get('push/public-key')
  getWebPushPublicKey() {
    return this.notifications.getWebPushPublicKey();
  }

  @Post('push/subscriptions')
  saveWebPushSubscription(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SaveWebPushSubscriptionDto,
  ) {
    return this.notifications.saveWebPushSubscription(user.id, body);
  }

  @Delete('push/subscriptions')
  removeWebPushSubscription(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RemoveWebPushSubscriptionDto,
  ) {
    return this.notifications.removeWebPushSubscription(user.id, body);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notifications.findAll(user.id, query);
  }

  @Get('unread-count')
  getUnreadCount(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MarkAllNotificationsReadDto,
  ) {
    return this.notifications.getUnreadCount(user.id, query.storeId);
  }

  @Patch('read-all')
  markAllAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: MarkAllNotificationsReadDto,
  ) {
    return this.notifications.markAllAsRead(user.id, body);
  }

  @Delete('all')
  removeAll(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: MarkAllNotificationsReadDto,
  ) {
    return this.notifications.removeAll(user.id, body);
  }

  @Patch(':notificationId/read')
  markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('notificationId', new ParseUUIDPipe()) notificationId: string,
  ) {
    return this.notifications.markAsRead(user.id, notificationId);
  }

  @Delete(':notificationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('notificationId', new ParseUUIDPipe()) notificationId: string,
  ) {
    return this.notifications.remove(user.id, notificationId);
  }
}
