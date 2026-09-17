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
  AuditActorType,
  AuditOrigin,
  AuditResult,
} from '../../../generated/prisma/enums';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown);
}

export enum AdminAuditPeriod {
  DAY = '24H',
  WEEK = '7D',
  MONTH = '30D',
}

export enum AdminAuditOrder {
  NEWEST = 'NEWEST',
  OLDEST = 'OLDEST',
}

export class AdminAuditLogsQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsEnum(AuditActorType)
  actorType?: AuditActorType;

  @IsOptional()
  @IsEnum(AuditOrigin)
  origin?: AuditOrigin;

  @IsOptional()
  @IsEnum(AuditResult)
  result?: AuditResult;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(160)
  action?: string;

  @IsOptional()
  @IsEnum(AdminAuditPeriod)
  period?: AdminAuditPeriod;

  @IsOptional()
  @IsEnum(AdminAuditOrder)
  order: AdminAuditOrder = AdminAuditOrder.NEWEST;

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
