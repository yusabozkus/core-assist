import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NOTIFICATION_EMAIL_DIGEST_QUEUE } from './notification-email-digest.constants';
import { NotificationEmailDigestProcessor } from './notification-email-digest.processor';
import { NotificationEmailDigestScheduler } from './notification-email-digest.scheduler';
import { NotificationEmailDigestService } from './notification-email-digest.service';
import { NotificationRetentionService } from './notification-retention.service';
import { NotificationStreamService } from './notification-stream.service';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: NOTIFICATION_EMAIL_DIGEST_QUEUE }),
  ],
  providers: [
    NotificationsService,
    NotificationStreamService,
    NotificationRetentionService,
    NotificationDeliveryService,
    NotificationEmailDigestService,
    NotificationEmailDigestScheduler,
    NotificationEmailDigestProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationCoreModule {}
