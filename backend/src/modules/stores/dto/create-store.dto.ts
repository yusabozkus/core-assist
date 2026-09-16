import { Transform, type TransformFnParams } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { InventoryPolicy } from '../../../generated/prisma/enums';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown);
}

export class CreateStoreDto {
  @Transform(trimString)
  @IsString()
  @Length(2, 80)
  name: string;

  @IsOptional()
  @IsEnum(InventoryPolicy)
  inventoryPolicy?: InventoryPolicy;
}
