import { Transform, type TransformFnParams } from 'class-transformer';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown);
}

export enum AdminSupportMessageVisibility {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
}

export class AdminSupportMessageDto {
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(5000)
  message!: string;

  @IsEnum(AdminSupportMessageVisibility)
  visibility!: AdminSupportMessageVisibility;
}
