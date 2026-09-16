import { IsOptional, IsUUID } from 'class-validator';

export class AdminSupportAssigneeDto {
  @IsOptional()
  @IsUUID()
  assigneeUserId!: string | null;
}
