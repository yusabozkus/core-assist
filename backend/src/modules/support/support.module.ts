import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationCoreModule } from '../notifications/notification-core.module';
import { SupportController } from './support.controller';
import { SUPPORT_NOTIFICATION_QUEUE } from './support-notification.constants';
import { SupportNotificationProcessor } from './support-notification.processor';
import { SupportNotificationScheduler } from './support-notification.scheduler';
import { SupportNotificationService } from './support-notification.service';
import { SupportService } from './support.service';

@Module({
  imports: [
    AuthModule,
    NotificationCoreModule,
    BullModule.registerQueue({ name: SUPPORT_NOTIFICATION_QUEUE }),
  ],
  controllers: [SupportController],
  providers: [
    SupportService,
    SupportNotificationService,
    SupportNotificationScheduler,
    SupportNotificationProcessor,
  ],
  exports: [SupportNotificationService],
})
export class SupportModule {}
