import { Transform, type TransformFnParams } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown);
}

export class CreateSupportMessageDto {
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(5000)
  message!: string;
}
