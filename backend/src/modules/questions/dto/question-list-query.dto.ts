import { Transform, Type, type TransformFnParams } from 'class-transformer';
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

export enum QuestionListStatusFilter {
  ALL = 'ALL',
  PENDING = 'PENDING',
  ANSWERED = 'ANSWERED',
  IGNORED = 'IGNORED',
}

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown);
}

export class QuestionListQueryDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 30;

  @IsOptional()
  @IsEnum(QuestionListStatusFilter)
  status: QuestionListStatusFilter = QuestionListStatusFilter.ALL;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(160)
  query?: string;
}
