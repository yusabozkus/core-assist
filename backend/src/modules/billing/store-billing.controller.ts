import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BillingEntitlementService } from './billing-entitlement.service';

@Controller('stores/:storeId/billing')
@UseGuards(AuthGuard)
export class StoreBillingController {
  constructor(private readonly entitlements: BillingEntitlementService) {}

  @Get('usage')
  getUsage(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.entitlements.getStoreUsageOverview(storeId, user.id);
  }
}
