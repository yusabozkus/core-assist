import { Module } from '@nestjs/common';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationRetentionService } from './notification-retention.service';
import { NotificationStreamService } from './notification-stream.service';
import { NotificationsService } from './notifications.service';

@Module({
  providers: [
    NotificationsService,
    NotificationStreamService,
    NotificationRetentionService,
    NotificationDeliveryService,
  ],
  exports: [NotificationsService],
})
export class NotificationCoreModule {}
