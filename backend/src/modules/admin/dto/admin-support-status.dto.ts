import { IsEnum } from 'class-validator';
import { SupportTicketStatus } from '../../../generated/prisma/enums';

export class AdminSupportStatusDto {
  @IsEnum(SupportTicketStatus)
  status!: SupportTicketStatus;
}
