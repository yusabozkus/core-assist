import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum SyncHistoryStatusFilter {
  ALL = 'ALL',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum SyncHistoryKindFilter {
  ALL = 'ALL',
  FULL = 'FULL',
  INVENTORY = 'INVENTORY',
  QUESTION = 'QUESTION',
}

export enum SyncHistoryOrder {
  NEWEST = 'NEWEST',
  OLDEST = 'OLDEST',
}

export class SyncHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;

  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @IsEnum(SyncHistoryStatusFilter)
  status: SyncHistoryStatusFilter = SyncHistoryStatusFilter.ALL;

  @IsOptional()
  @IsEnum(SyncHistoryKindFilter)
  kind: SyncHistoryKindFilter = SyncHistoryKindFilter.ALL;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  provider?: string;

  @IsOptional()
  @IsEnum(SyncHistoryOrder)
  order: SyncHistoryOrder = SyncHistoryOrder.NEWEST;

  @IsOptional()
  @IsISO8601()
  from?: string;
}
