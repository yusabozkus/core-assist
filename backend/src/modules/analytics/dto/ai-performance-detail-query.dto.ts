import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { AiPerformanceQueryDto } from './ai-performance-query.dto';

export enum AiPerformanceDetailKind {
  REVIEW_REASON = 'REVIEW_REASON',
  FAILED_DELIVERY = 'FAILED_DELIVERY',
}

export class AiPerformanceDetailQueryDto extends AiPerformanceQueryDto {
  @IsEnum(AiPerformanceDetailKind)
  kind: AiPerformanceDetailKind;

  @ValidateIf(
    (query: AiPerformanceDetailQueryDto) =>
      query.kind === AiPerformanceDetailKind.REVIEW_REASON,
  )
  @IsString()
  @MaxLength(80)
  @Matches(/^[A-Z][A-Z0-9_]*$/)
  reason?: string;

  @IsOptional()
  @IsDateString()
  asOf?: string;

  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @IsDateString()
  before?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 25;
}
