import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminActionOriginGuard } from '../admin/admin-action-origin.guard';
import { NotificationCoreModule } from '../notifications/notification-core.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { SupportController } from './support.controller';
import { SupportAttachmentService } from './support-attachment.service';
import { SupportImageRateLimitGuard } from './support-image-rate-limit.guard';
import { SUPPORT_NOTIFICATION_QUEUE } from './support-notification.constants';
import { SupportNotificationProcessor } from './support-notification.processor';
import { SupportNotificationScheduler } from './support-notification.scheduler';
import { SupportNotificationService } from './support-notification.service';
import { SupportService } from './support.service';

@Module({
  imports: [
    AuthModule,
    NotificationCoreModule,
    WorkspacesModule,
    BullModule.registerQueue({ name: SUPPORT_NOTIFICATION_QUEUE }),
  ],
  controllers: [SupportController],
  providers: [
    SupportService,
    AdminActionOriginGuard,
    SupportAttachmentService,
    SupportImageRateLimitGuard,
    SupportNotificationService,
    SupportNotificationScheduler,
    SupportNotificationProcessor,
  ],
  exports: [
    SupportNotificationService,
    SupportAttachmentService,
    SupportImageRateLimitGuard,
  ],
})
export class SupportModule {}
