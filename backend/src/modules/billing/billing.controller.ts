import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BillingEntitlementService } from './billing-entitlement.service';
import { CreateBillingCheckoutDto } from './dto/create-billing-checkout.dto';
import { PaddleBillingService } from './paddle-billing.service';

@Controller('stores/:storeId/billing')
@UseGuards(AuthGuard)
export class BillingController {
  constructor(
    private readonly entitlements: BillingEntitlementService,
    private readonly paddleBilling: PaddleBillingService,
  ) {}

  @Get('summary')
  getSummary(
    @Param('storeId') storeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.entitlements.getSummaryForStore(storeId, user.id);
  }

  @Post('checkout')
  createCheckout(
    @Param('storeId') storeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateBillingCheckoutDto,
  ) {
    return this.paddleBilling.createCheckout(
      storeId,
      user.id,
      input.plan,
      input.cycle,
    );
  }
}
