import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import {
  BILLING_RECOVERY_QUEUE,
  BillingReconciliationProcessor,
} from './billing-reconciliation.processor';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BillingController } from './billing.controller';
import { BillingPricingController } from './billing-pricing.controller';
import { BillingWorkspacesController } from './billing-workspaces.controller';
import { BillingAuthorizationService } from './billing-authorization.service';
import { BillingEntitlementService } from './billing-entitlement.service';
import { BillingSubscriptionService } from './billing-subscription.service';
import { BillingUsageService } from './billing-usage.service';
import { BillingUsageNotificationService } from './billing-usage-notification.service';
import { PaddleBillingService } from './paddle-billing.service';
import { PaddleWebhookController } from './paddle-webhook.controller';
import { PaddleCheckoutBindingService } from './paddle-checkout-binding.service';
import { PaddleCheckoutService } from './paddle-checkout.service';
import { PaddlePlanChangeService } from './paddle-plan-change.service';
import { PADDLE_WEBHOOK_QUEUE } from './paddle-webhook.constants';
import { PaddleWebhookQueueService } from './paddle-webhook-queue.service';
import { PaddleWebhookProcessor } from './paddle-webhook.processor';
import { BillingRetentionService } from './billing-retention.service';
import { StoreBillingController } from './store-billing.controller';

@Module({
  imports: [
    AuthModule,
    WorkspacesModule,
    NotificationsModule,
    BullModule.registerQueue(
      { name: BILLING_RECOVERY_QUEUE },
      { name: PADDLE_WEBHOOK_QUEUE },
    ),
  ],
  controllers: [
    BillingController,
    BillingPricingController,
    BillingWorkspacesController,
    StoreBillingController,
    PaddleWebhookController,
  ],
  providers: [
    BillingReconciliationProcessor,
    BillingAuthorizationService,
    BillingSubscriptionService,
    BillingUsageService,
    BillingUsageNotificationService,
    BillingEntitlementService,
    PaddleBillingService,
    PaddleCheckoutBindingService,
    PaddleCheckoutService,
    PaddlePlanChangeService,
    PaddleWebhookQueueService,
    PaddleWebhookProcessor,
    BillingRetentionService,
  ],
  exports: [
    BillingSubscriptionService,
    BillingUsageService,
    BillingUsageNotificationService,
    BillingEntitlementService,
  ],
})
export class BillingModule {}
