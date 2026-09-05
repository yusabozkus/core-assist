import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  IsUUID,
} from 'class-validator';
import {
  AiEmojiPolicy,
  AiResponseLength,
  AiTone,
  IntegrationEnvironment,
} from '../../../generated/prisma/enums';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown);
}

export enum OnboardingChannel {
  TRENDYOL = 'TRENDYOL',
  HEPSIBURADA = 'HEPSIBURADA',
}

export class ProvisionOnboardingDto {
  @Transform(trimString)
  @IsString()
  @Length(2, 80)
  storeName: string;

  @IsEnum(OnboardingChannel)
  selectedChannel: OnboardingChannel;

  @IsOptional()
  @IsEnum(IntegrationEnvironment)
  environment?: IntegrationEnvironment;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(1_000)
  brandDescription?: string;

  @IsOptional()
  @IsEnum(AiTone)
  tone?: AiTone;

  @IsOptional()
  @IsEnum(AiResponseLength)
  responseLength?: AiResponseLength;

  @IsOptional()
  @IsBoolean()
  greetingEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  closingEnabled?: boolean;

  @IsOptional()
  @IsEnum(AiEmojiPolicy)
  emojiPolicy?: AiEmojiPolicy;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(16)
  @Matches(
    /^(?:\p{Regional_Indicator}{2}|(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0E|\uFE0F)?(?:\p{Emoji_Modifier})?(?:\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0E|\uFE0F)?(?:\p{Emoji_Modifier})?)*)$/u,
    { message: 'Tercih edilen emoji yalnızca tek bir emoji içermelidir.' },
  )
  preferredEmoji?: string;
}

export class CompleteOnboardingDto {
  @IsUUID()
  storeId: string;

  @IsEnum(AiTone)
  tone: AiTone;

  @IsEnum(AiResponseLength)
  responseLength: AiResponseLength;
}
