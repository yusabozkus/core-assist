import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { NotificationType } from '../../../generated/prisma/enums';

export enum NotificationReadFilter {
  ALL = 'ALL',
  UNREAD = 'UNREAD',
}

export class ListNotificationsQueryDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;

  @IsOptional()
  @IsEnum(NotificationReadFilter)
  status: NotificationReadFilter = NotificationReadFilter.ALL;

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @IsOptional()
  @IsUUID()
  storeId?: string;
}
