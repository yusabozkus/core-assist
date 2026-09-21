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
  CatalogSyncKind,
  CatalogSyncStatus,
  IntegrationEnvironment,
} from '../../../generated/prisma/enums';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown);
}

export enum AdminOperationIssueFilter {
  STALE = 'STALE',
  CONNECTION = 'CONNECTION',
}

export enum AdminOperationPeriod {
  DAY = '24H',
  WEEK = '7D',
  MONTH = '30D',
}

export enum AdminOperationOrder {
  NEWEST = 'NEWEST',
  OLDEST = 'OLDEST',
}

export class AdminOperationsQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsEnum(CatalogSyncStatus)
  status?: CatalogSyncStatus;

  @IsOptional()
  @IsEnum(CatalogSyncKind)
  kind?: CatalogSyncKind;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(50)
  provider?: string;

  @IsOptional()
  @IsEnum(IntegrationEnvironment)
  environment?: IntegrationEnvironment;

  @IsOptional()
  @IsEnum(AdminOperationIssueFilter)
  issue?: AdminOperationIssueFilter;

  @IsOptional()
  @IsEnum(AdminOperationPeriod)
  period?: AdminOperationPeriod;

  @IsOptional()
  @IsEnum(AdminOperationOrder)
  order: AdminOperationOrder = AdminOperationOrder.NEWEST;

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

export class AdminQueueFailuresQueryDto {
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
