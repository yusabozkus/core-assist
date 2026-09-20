import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AdminSupportAssigneeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  assigneeUserId!: string | null;
}
