import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export enum AdminAiBlockerType {
  GENERATION_FAILURES = 'generation-failures',
  DELIVERY_FAILURES = 'delivery-failures',
  QUOTA = 'quota',
  SUBSCRIPTION = 'subscription',
  MISSING_INFORMATION = 'missing-information',
  KNOWLEDGE_CONFLICTS = 'knowledge-conflicts',
}

export class AdminAiBlockersQueryDto {
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
