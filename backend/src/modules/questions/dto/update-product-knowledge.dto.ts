import { Transform, type TransformFnParams } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown);
}

export class UpdateProductKnowledgeDto {
  @Transform(trimString)
  @IsString()
  @Length(1, 1000)
  value: string;

  @IsOptional()
  @IsBoolean()
  confirmUnusualValue?: boolean;
}
