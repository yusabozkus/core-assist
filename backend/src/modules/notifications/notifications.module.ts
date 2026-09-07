import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationStreamService } from './notification-stream.service';
import { NotificationRetentionService } from './notification-retention.service';
import { NotificationDeliveryService } from './notification-delivery.service';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationStreamService,
    NotificationRetentionService,
    NotificationDeliveryService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
