import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export enum ActivityCategory {
  ALL = 'ALL',
  ANSWERS = 'ANSWERS',
  SETTINGS = 'SETTINGS',
  CATALOG = 'CATALOG',
  CHANNELS = 'CHANNELS',
  TEAM = 'TEAM',
  BILLING = 'BILLING',
}

export enum ActivityPeriod {
  ALL = 'ALL',
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
}

export enum ActivityResultFilter {
  ALL = 'ALL',
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
}

export enum ActivityActorFilter {
  ALL = 'ALL',
  SYSTEM = 'SYSTEM',
  TEAM = 'TEAM',
}

export class ActivityQueryDto {
  @IsOptional()
  @IsEnum(ActivityCategory)
  category: ActivityCategory = ActivityCategory.ALL;

  @IsOptional()
  @IsEnum(ActivityPeriod)
  period: ActivityPeriod = ActivityPeriod.ALL;

  @IsOptional()
  @IsEnum(ActivityResultFilter)
  result: ActivityResultFilter = ActivityResultFilter.ALL;

  @IsOptional()
  @IsEnum(ActivityActorFilter)
  actor: ActivityActorFilter = ActivityActorFilter.TEAM;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([50, 100, 200])
  limit = 50;
}
