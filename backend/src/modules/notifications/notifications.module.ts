import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationCoreModule } from './notification-core.module';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [AuthModule, NotificationCoreModule],
  controllers: [NotificationsController],
  exports: [NotificationCoreModule],
})
export class NotificationsModule {}
