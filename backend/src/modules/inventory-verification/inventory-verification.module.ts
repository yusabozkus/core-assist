import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { InventoryVerificationService } from './inventory-verification.service';

@Module({
  imports: [IntegrationsModule],
  providers: [InventoryVerificationService],
  exports: [InventoryVerificationService],
})
export class InventoryVerificationModule {}
