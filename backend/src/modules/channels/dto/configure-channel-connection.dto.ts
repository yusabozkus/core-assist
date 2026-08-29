import { IsEnum, IsObject } from 'class-validator';
import { IntegrationEnvironment } from '../../../generated/prisma/enums';

export class ConfigureChannelConnectionDto {
  @IsEnum(IntegrationEnvironment)
  environment: IntegrationEnvironment;

  @IsObject()
  credentials: Record<string, unknown>;
}
