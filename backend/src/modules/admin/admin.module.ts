import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { AdminAccessService } from './admin-access.service';
import { AdminActionOriginGuard } from './admin-action-origin.guard';
import { AdminBillingController } from './admin-billing.controller';
import { AdminBillingService } from './admin-billing.service';
import { AdminController } from './admin.controller';
import { AdminCustomersController } from './admin-customers.controller';
import { AdminCustomersService } from './admin-customers.service';
import { AdminGuard } from './admin.guard';
import { AdminOverviewService } from './admin-overview.service';
import { AdminSupportController } from './admin-support.controller';
import { AdminSupportService } from './admin-support.service';

@Module({
  imports: [AuthModule, BillingModule],
  controllers: [
    AdminController,
    AdminBillingController,
    AdminCustomersController,
    AdminSupportController,
  ],
  providers: [
    AdminAccessService,
    AdminActionOriginGuard,
    AdminBillingService,
    AdminGuard,
    AdminCustomersService,
    AdminOverviewService,
    AdminSupportService,
  ],
  exports: [AdminAccessService, AdminGuard],
})
export class AdminModule {}
