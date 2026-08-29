import { IsEnum } from 'class-validator';
import { ChannelProvider } from '../../../generated/prisma/enums';

export class CreateChannelConnectionDto {
  @IsEnum(ChannelProvider)
  provider: ChannelProvider;
}
