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
import { BillingPlan } from '../../../generated/prisma/enums';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown);
}

export enum AdminCustomerSubscriptionFilter {
  TRIALING = 'TRIALING',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  PAUSED = 'PAUSED',
  CANCELED = 'CANCELED',
  EXPIRED = 'EXPIRED',
  NONE = 'NONE',
}

export enum AdminCustomerOnboardingFilter {
  COMPLETED = 'COMPLETED',
  PENDING = 'PENDING',
}

export enum AdminCustomerSort {
  NEWEST = 'NEWEST',
  OLDEST = 'OLDEST',
  NAME = 'NAME',
}

export class AdminCustomersQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsEnum(BillingPlan)
  plan?: BillingPlan;

  @IsOptional()
  @IsEnum(AdminCustomerSubscriptionFilter)
  subscription?: AdminCustomerSubscriptionFilter;

  @IsOptional()
  @IsEnum(AdminCustomerOnboardingFilter)
  onboarding?: AdminCustomerOnboardingFilter;

  @IsOptional()
  @IsEnum(AdminCustomerSort)
  sort: AdminCustomerSort = AdminCustomerSort.NEWEST;

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
