import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  BillingPlan,
  BillingSubscriptionStatus,
} from '../../../generated/prisma/enums';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown);
}

export enum AdminBillingIssueFilter {
  PAYMENT = 'PAYMENT',
  RECONCILIATION = 'RECONCILIATION',
  CHECKOUT = 'CHECKOUT',
  PLAN_CHANGE = 'PLAN_CHANGE',
}

export enum AdminBillingSort {
  UPDATED = 'UPDATED',
  PERIOD_END = 'PERIOD_END',
  FAILURES = 'FAILURES',
}

export class AdminBillingQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsEnum(BillingPlan)
  plan?: BillingPlan;

  @IsOptional()
  @IsEnum(BillingSubscriptionStatus)
  status?: BillingSubscriptionStatus;

  @IsOptional()
  @IsEnum(AdminBillingIssueFilter)
  issue?: AdminBillingIssueFilter;

  @IsOptional()
  @IsEnum(AdminBillingSort)
  sort: AdminBillingSort = AdminBillingSort.UPDATED;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(100)
  pageSize: number = 25;
}
