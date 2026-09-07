import { IsUUID } from 'class-validator';

export class NotificationStoreQueryDto {
  @IsUUID()
  storeId!: string;
}
