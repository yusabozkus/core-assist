import { Equals, IsString } from 'class-validator';

export const STORE_DELETE_CONFIRMATION = 'Evet, onaylıyorum';

export class DeleteStoreDto {
  @IsString()
  @Equals(STORE_DELETE_CONFIRMATION, {
    message: `Silme onayı birebir "${STORE_DELETE_CONFIRMATION}" olmalıdır.`,
  })
  confirmation: string;
}
