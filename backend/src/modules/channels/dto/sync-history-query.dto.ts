import { Type } from 'class-transformer';
import {
  IsEnum,
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
}
