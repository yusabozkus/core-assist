import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export enum AnnouncementRole {
  OWNER = 'OWNER',
  ACCOUNT_ADMIN = 'ACCOUNT_ADMIN',
  STORE_ADMIN = 'STORE_ADMIN',
  AGENT = 'AGENT',
  VIEWER = 'VIEWER',
}

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class AdminAnnouncementsQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;
}

export class PreviewAdminAnnouncementDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  @Matches(/^[^\r\n]+$/)
  title: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  message: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsEnum(AnnouncementRole, { each: true })
  roles: AnnouncementRole[];

  @IsBoolean()
  sendEmail: boolean;
}
