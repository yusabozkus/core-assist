import { Transform, type TransformFnParams } from 'class-transformer';
import { IsString, Length } from 'class-validator';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateProfileDto {
  @Transform(trimString)
  @IsString()
  @Length(2, 80)
  name: string;
}
