import { IsEnum, IsOptional } from 'class-validator';

export enum DashboardRange {
  SEVEN_DAYS = '7D',
  THIRTY_DAYS = '30D',
}

export class DashboardQueryDto {
  @IsOptional()
  @IsEnum(DashboardRange)
  range: DashboardRange = DashboardRange.SEVEN_DAYS;
}
