import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum AiPerformanceRange {
  SEVEN_DAYS = '7D',
  THIRTY_DAYS = '30D',
  NINETY_DAYS = '90D',
  ALL = 'ALL',
}

export class AiPerformanceQueryDto {
  @IsOptional()
  @IsEnum(AiPerformanceRange)
  range: AiPerformanceRange = AiPerformanceRange.THIRTY_DAYS;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  provider?: string;
}
