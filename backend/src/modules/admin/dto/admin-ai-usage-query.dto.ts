import { IsEnum, IsOptional } from 'class-validator';

export enum AdminAiUsagePeriod {
  WEEK = '7D',
  MONTH = '30D',
  QUARTER = '90D',
}

export class AdminAiUsageQueryDto {
  @IsOptional()
  @IsEnum(AdminAiUsagePeriod)
  period: AdminAiUsagePeriod = AdminAiUsagePeriod.MONTH;
}
