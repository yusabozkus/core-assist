import { Transform, type TransformFnParams } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

function normalizeEmail({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export enum TeamAccessLevel {
  ACCOUNT_ADMIN = 'ACCOUNT_ADMIN',
  STORE_ADMIN = 'STORE_ADMIN',
  AGENT = 'AGENT',
  VIEWER = 'VIEWER',
}

export class CreateWorkspaceInvitationDto {
  @Transform(normalizeEmail)
  @IsString()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsEnum(TeamAccessLevel)
  accessLevel: TeamAccessLevel;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  storeIds?: string[];
}

export class UpdateWorkspaceMemberDto {
  @IsEnum(TeamAccessLevel)
  accessLevel: TeamAccessLevel;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  storeIds?: string[];
}
