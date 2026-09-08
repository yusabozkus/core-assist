import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BillingEntitlementService } from './billing-entitlement.service';

@Controller('stores/:storeId/billing')
@UseGuards(AuthGuard)
export class BillingController {
  constructor(private readonly entitlements: BillingEntitlementService) {}

  @Get('summary')
  getSummary(
    @Param('storeId') storeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.entitlements.getSummaryForStore(storeId, user.id);
  }
}
