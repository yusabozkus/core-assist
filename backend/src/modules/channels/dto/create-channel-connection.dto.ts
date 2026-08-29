import { IsEnum, IsObject, IsString, Matches } from 'class-validator';
import { IntegrationEnvironment } from '../../../generated/prisma/enums';

export class CreateChannelConnectionDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  providerKey: string;

  @IsEnum(IntegrationEnvironment)
  environment: IntegrationEnvironment;

  @IsObject()
  credentials: Record<string, unknown>;
}
