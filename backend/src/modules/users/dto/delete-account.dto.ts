import { Equals } from 'class-validator';

export class DeleteAccountDto {
  @Equals('HESABIMI SİL')
  confirmation: string;
}

export class CloseAccountBillingDto {
  @Equals('TAHSİLATI DURDUR')
  confirmation: string;
}
