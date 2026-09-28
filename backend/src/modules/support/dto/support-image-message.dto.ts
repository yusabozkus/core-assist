import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AdminSupportMessageVisibility } from '../../admin/dto/admin-support-message.dto';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown);
}

export class SupportImageMessageDto {
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(5000)
  message?: string;
}

export class AdminSupportImageMessageDto extends SupportImageMessageDto {
  @IsEnum(AdminSupportMessageVisibility)
  visibility!: AdminSupportMessageVisibility;
}
