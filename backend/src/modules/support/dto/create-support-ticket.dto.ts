import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  SupportTicketCategory,
  SupportTicketImpact,
} from '../../../generated/prisma/enums';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown);
}

export class CreateSupportTicketDto {
  @IsEnum(SupportTicketCategory)
  category!: SupportTicketCategory;

  @IsEnum(SupportTicketImpact)
  impact!: SupportTicketImpact;

  @Transform(trimString)
  @IsString()
  @MinLength(6)
  @MaxLength(120)
  subject!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  message!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  pagePath?: string;
}
