import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BillingController } from './billing.controller';
import { BillingEntitlementService } from './billing-entitlement.service';
import { BillingSubscriptionService } from './billing-subscription.service';
import { BillingUsageService } from './billing-usage.service';
import { BillingUsageNotificationService } from './billing-usage-notification.service';
import { PaddleBillingService } from './paddle-billing.service';
import { PaddleWebhookController } from './paddle-webhook.controller';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [BillingController, PaddleWebhookController],
  providers: [
    BillingSubscriptionService,
    BillingUsageService,
    BillingUsageNotificationService,
    BillingEntitlementService,
    PaddleBillingService,
  ],
  exports: [
    BillingSubscriptionService,
    BillingUsageService,
    BillingUsageNotificationService,
    BillingEntitlementService,
  ],
})
export class BillingModule {}
