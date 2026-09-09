import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BillingController } from './billing.controller';
import { BillingEntitlementService } from './billing-entitlement.service';
import { BillingSubscriptionService } from './billing-subscription.service';
import { BillingUsageService } from './billing-usage.service';
import { BillingUsageNotificationService } from './billing-usage-notification.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [BillingController],
  providers: [
    BillingSubscriptionService,
    BillingUsageService,
    BillingUsageNotificationService,
    BillingEntitlementService,
  ],
  exports: [
    BillingSubscriptionService,
    BillingUsageService,
    BillingUsageNotificationService,
    BillingEntitlementService,
  ],
})
export class BillingModule {}
