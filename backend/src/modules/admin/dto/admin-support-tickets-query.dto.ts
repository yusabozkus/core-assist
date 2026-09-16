import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from '../../../generated/prisma/enums';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown);
}

export enum AdminSupportAssigneeFilter {
  ME = 'ME',
  UNASSIGNED = 'UNASSIGNED',
}

export enum AdminSupportSort {
  LAST_ACTIVITY = 'LAST_ACTIVITY',
  OLDEST = 'OLDEST',
  SLA = 'SLA',
}

export class AdminSupportTicketsQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @IsOptional()
  @IsEnum(SupportTicketPriority)
  priority?: SupportTicketPriority;

  @IsOptional()
  @IsEnum(SupportTicketCategory)
  category?: SupportTicketCategory;

  @IsOptional()
  @IsEnum(AdminSupportAssigneeFilter)
  assignee?: AdminSupportAssigneeFilter;

  @IsOptional()
  @IsEnum(AdminSupportSort)
  sort: AdminSupportSort = AdminSupportSort.LAST_ACTIVITY;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(100)
  pageSize: number = 25;
}
