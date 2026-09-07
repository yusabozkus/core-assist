import {
  IsDefined,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class WebPushSubscriptionKeysDto {
  @IsString()
  @MaxLength(512)
  p256dh!: string;

  @IsString()
  @MaxLength(512)
  auth!: string;
}

export class SaveWebPushSubscriptionDto {
  @IsUUID()
  storeId!: string;

  @IsString()
  @IsUrl({ require_protocol: true })
  @MaxLength(2_048)
  endpoint!: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => WebPushSubscriptionKeysDto)
  keys!: WebPushSubscriptionKeysDto;
}

export class RemoveWebPushSubscriptionDto {
  @IsString()
  @IsUrl({ require_protocol: true })
  @MaxLength(2_048)
  endpoint!: string;
}
