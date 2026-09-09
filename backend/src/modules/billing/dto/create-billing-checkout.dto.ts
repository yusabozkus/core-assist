import { IsEnum } from 'class-validator';
import { BillingCycle, BillingPlan } from '../../../generated/prisma/enums';

export class CreateBillingCheckoutDto {
  @IsEnum(BillingPlan)
  plan: BillingPlan;

  @IsEnum(BillingCycle)
  cycle: BillingCycle;
}
