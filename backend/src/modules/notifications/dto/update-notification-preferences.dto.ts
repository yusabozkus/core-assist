import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { NotificationType } from '../../../generated/prisma/enums';

export class NotificationPreferenceItemDto {
  @IsEnum(NotificationType)
  type!: NotificationType;

  @IsBoolean()
  enabled!: boolean;
}

export class UpdateNotificationPreferencesDto {
  @IsUUID()
  storeId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((preference: NotificationPreferenceItemDto) => preference.type)
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferenceItemDto)
  preferences!: NotificationPreferenceItemDto[];
}
