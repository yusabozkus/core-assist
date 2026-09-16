import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminAccessService } from './admin-access.service';
import { AdminActionOriginGuard } from './admin-action-origin.guard';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminOverviewService } from './admin-overview.service';
import { AdminSupportController } from './admin-support.controller';
import { AdminSupportService } from './admin-support.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminController, AdminSupportController],
  providers: [
    AdminAccessService,
    AdminActionOriginGuard,
    AdminGuard,
    AdminOverviewService,
    AdminSupportService,
  ],
  exports: [AdminAccessService, AdminGuard],
})
export class AdminModule {}
