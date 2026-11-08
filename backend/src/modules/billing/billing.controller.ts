import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { assertBillingActionOrigin } from './billing-action-origin';
import { BillingEntitlementService } from './billing-entitlement.service';
import { CreateBillingCheckoutDto } from './dto/create-billing-checkout.dto';
import { ManageSubscriptionDto } from './dto/manage-subscription.dto';
import { PaddleBillingService } from './paddle-billing.service';
import { BillingAuthorizationService } from './billing-authorization.service';
import { PaddlePlanChangeService } from './paddle-plan-change.service';

@Controller('workspaces/:workspaceId/billing')
@UseGuards(AuthGuard)
export class BillingController {
  constructor(
    private readonly entitlements: BillingEntitlementService,
    private readonly paddleBilling: PaddleBillingService,
    private readonly authorization: BillingAuthorizationService,
    private readonly planChanges: PaddlePlanChangeService,
  ) {}

  @Get('access')
  async getAccess(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { canManageBilling } = await this.authorization.getWorkspaceAccess(
      workspaceId,
      user.id,
    );
    // Only the caller's capability is exposed, never financial or member data.
    return { canManageBilling };
  }

  @Get('summary')
  getSummary(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.entitlements.getAuthorizedSummary(workspaceId, user.id);
  }

  @Post('checkout')
  createCheckout(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateBillingCheckoutDto,
    @Headers('origin') origin: string | undefined,
  ) {
    assertBillingActionOrigin(origin);
    return this.paddleBilling.createCheckout(
      workspaceId,
      user.id,
      input.plan,
      input.cycle,
    );
  }

  @Post('checkout/cancel')
  cancelCheckout(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('origin') origin: string | undefined,
  ) {
    assertBillingActionOrigin(origin);
    return this.paddleBilling.cancelPendingCheckout(workspaceId, user.id);
  }

  @Get('invoices')
  getInvoices(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paddleBilling.getBillingHistory(workspaceId, user.id);
  }

  @Post('plan-changes/preview')
  previewPlanChange(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateBillingCheckoutDto,
    @Headers('origin') origin: string | undefined,
  ) {
    assertBillingActionOrigin(origin);
    return this.planChanges.preview(
      workspaceId,
      user.id,
      input.plan,
      input.cycle,
    );
  }

  @Post('plan-changes/:changeId/confirm')
  confirmPlanChange(
    @Param('workspaceId') workspaceId: string,
    @Param('changeId') changeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('origin') origin: string | undefined,
  ) {
    assertBillingActionOrigin(origin);
    return this.planChanges.confirm(workspaceId, user.id, changeId);
  }

  @Get('plan-changes/:changeId')
  getPlanChange(
    @Param('workspaceId') workspaceId: string,
    @Param('changeId') changeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.planChanges.getStatus(workspaceId, user.id, changeId);
  }

  @Get('invoices/:transactionId/pdf')
  getInvoicePdf(
    @Param('workspaceId') workspaceId: string,
    @Param('transactionId') transactionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paddleBilling.getInvoicePdf(
      workspaceId,
      user.id,
      transactionId,
    );
  }

  @Post('portal-session')
  createPortalSession(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('origin') origin: string | undefined,
  ) {
    assertBillingActionOrigin(origin);
    return this.paddleBilling.createPortalSession(workspaceId, user.id);
  }

  @Post('payment-method/checkout')
  createPaymentMethodCheckout(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('origin') origin: string | undefined,
  ) {
    assertBillingActionOrigin(origin);
    return this.paddleBilling.createPaymentMethodCheckout(workspaceId, user.id);
  }

  @Get('payment-method/checkout/:transactionId')
  getPaymentMethodCheckoutStatus(
    @Param('workspaceId') workspaceId: string,
    @Param('transactionId') transactionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paddleBilling.getPaymentMethodCheckoutStatus(
      workspaceId,
      user.id,
      transactionId,
    );
  }

  @Get('subscription-management')
  getSubscriptionManagement(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paddleBilling.getSubscriptionManagement(workspaceId, user.id);
  }

  @Post('subscription-management')
  manageSubscription(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: ManageSubscriptionDto,
    @Headers('origin') origin: string | undefined,
  ) {
    assertBillingActionOrigin(origin);
    return this.paddleBilling.manageSubscription(workspaceId, user.id, input);
  }

  @Post('refresh')
  refreshSubscription(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('origin') origin: string | undefined,
  ) {
    assertBillingActionOrigin(origin);
    return this.paddleBilling.refreshSubscriptionState(workspaceId, user.id);
  }
}
