import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsArray,
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

export enum PendingQuestionStateFilter {
  WAITING = 'WAITING',
  DRAFT_QUEUED = 'DRAFT_QUEUED',
  DRAFT_PROCESSING = 'DRAFT_PROCESSING',
  REVIEW_REQUIRED = 'REVIEW_REQUIRED',
  READY_TO_SEND = 'READY_TO_SEND',
  SEND_QUEUED = 'SEND_QUEUED',
  SENDING = 'SENDING',
  BLOCKED_QUOTA = 'BLOCKED_QUOTA',
  BLOCKED_SUBSCRIPTION = 'BLOCKED_SUBSCRIPTION',
  DRAFT_FAILED = 'DRAFT_FAILED',
  SEND_FAILED = 'SEND_FAILED',
  SEND_REVIEW = 'SEND_REVIEW',
}

export const ALL_PENDING_QUESTION_STATES = Object.values(
  PendingQuestionStateFilter,
);

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown);
}

function parseBoolean({ value }: TransformFnParams): unknown {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value as unknown;
}

function parsePendingStates({ value }: TransformFnParams): unknown {
  const values = Array.isArray(value) ? value : [value];
  return [
    ...new Set(
      values
        .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
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
  status: QuestionListStatusFilter = QuestionListStatusFilter.PENDING;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(ALL_PENDING_QUESTION_STATES.length)
  @IsEnum(PendingQuestionStateFilter, { each: true })
  @Transform(parsePendingStates)
  pendingStates: PendingQuestionStateFilter[] = [
    ...ALL_PENDING_QUESTION_STATES,
  ];

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(160)
  query?: string;

  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  includeSummary = true;
}
