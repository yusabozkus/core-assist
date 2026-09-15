import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown);
}

export class ResolveProductKnowledgeDto {
  @Transform(trimString)
  @IsString()
  @Length(2, 100)
  gapKey: string;

  @Transform(trimString)
  @IsString()
  @Length(1, 1000)
  value: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @IsBoolean()
  confirmUnusualValue?: boolean;
}
