import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown);
}

export class AiTestQuestionDto {
  @IsUUID()
  productId: string;

  @Transform(trimString)
  @IsString()
  @Length(2, 1000)
  question: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(50)
  providerKey?: string;
}
