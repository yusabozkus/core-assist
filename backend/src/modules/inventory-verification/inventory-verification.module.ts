import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { BillingModule } from '../billing/billing.module';
import { InventoryVerificationService } from './inventory-verification.service';

@Module({
  imports: [IntegrationsModule, BillingModule],
  providers: [InventoryVerificationService],
  exports: [InventoryVerificationService],
})
export class InventoryVerificationModule {}
