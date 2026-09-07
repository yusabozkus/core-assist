import { IsOptional, IsUUID } from 'class-validator';

export class MarkAllNotificationsReadDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;
}
