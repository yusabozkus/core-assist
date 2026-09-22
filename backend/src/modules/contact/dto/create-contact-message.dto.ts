import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { ContactMessageTopic } from '../../../generated/prisma/enums';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown);
}

export class CreateContactMessageDto {
  @Transform(trimString)
  @IsString()
  @Length(2, 80)
  name!: string;

  @Transform(trimString)
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  company?: string;

  @IsEnum(ContactMessageTopic)
  topic!: ContactMessageTopic;

  @Transform(trimString)
  @IsString()
  @Length(3, 140)
  subject!: string;

  @Transform(trimString)
  @IsString()
  @Length(20, 3_000)
  message!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(200)
  sourcePage?: string;

  // Hidden browser field. A non-empty value is accepted without persistence
  // so simple bots cannot use validation responses to tune their payloads.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
