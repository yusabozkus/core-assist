import { IsEnum } from 'class-validator';

export enum SupportTicketUserAction {
  RESOLVE = 'RESOLVE',
  REOPEN = 'REOPEN',
}

export class UpdateSupportTicketStatusDto {
  @IsEnum(SupportTicketUserAction)
  action!: SupportTicketUserAction;
}
