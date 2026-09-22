import { IsEnum } from 'class-validator';
import { ContactMessageStatus } from '../../../generated/prisma/enums';

export class AdminContactMessageStatusDto {
  @IsEnum(ContactMessageStatus)
  status!: ContactMessageStatus;
}
