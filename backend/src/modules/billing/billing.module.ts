import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingController } from './billing.controller';
import { BillingEntitlementService } from './billing-entitlement.service';
import { BillingSubscriptionService } from './billing-subscription.service';
import { BillingUsageService } from './billing-usage.service';

@Module({
  imports: [AuthModule],
  controllers: [BillingController],
  providers: [
    BillingSubscriptionService,
    BillingUsageService,
    BillingEntitlementService,
  ],
  exports: [
    BillingSubscriptionService,
    BillingUsageService,
    BillingEntitlementService,
  ],
})
export class BillingModule {}
