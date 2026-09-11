import { Controller, Get, Header } from '@nestjs/common';
import { BillingCycle, BillingPlan } from '../../generated/prisma/enums';
import {
  paddleCheckoutEnvironment,
  paddlePriceId,
} from './paddle-billing.config';

@Controller('billing/pricing')
export class BillingPricingController {
  @Get()
  @Header('Cache-Control', 'public, max-age=300, must-revalidate')
  getPricingConfig() {
    return {
      environment: paddleCheckoutEnvironment().toLowerCase(),
      items: Object.values(BillingPlan).flatMap((plan) =>
        Object.values(BillingCycle).map((cycle) => ({
          plan,
          cycle,
          priceId: paddlePriceId(plan, cycle),
        })),
      ),
    };
  }
}
