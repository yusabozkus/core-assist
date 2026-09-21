import { IsOptional, IsUUID } from 'class-validator';

export class NotificationStreamQueryDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;
}
