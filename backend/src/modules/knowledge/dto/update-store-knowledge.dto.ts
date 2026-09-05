import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  AiAutomationMode,
  AiEmojiPolicy,
  AiResponseLength,
  AiTone,
} from '../../../generated/prisma/enums';

export class KnowledgeFaqDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  question: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  answer: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class AiInstructionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1_000)
  content: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ChannelKnowledgeOverrideDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  providerKey: string;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  shippingPolicy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  returnPolicy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  exchangePolicy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  warrantyPolicy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  additionalInformation?: string;
}

export class UpdateStoreKnowledgeDto {
  @IsOptional()
  @IsEnum(AiAutomationMode)
  automationMode?: AiAutomationMode;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.85)
  @Max(0.99)
  minimumAutoSendConfidence?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  brandDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  shippingPolicy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  returnPolicy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  exchangePolicy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  warrantyPolicy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  additionalInformation?: string;

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
  @IsString()
  @MaxLength(16)
  @Matches(
    /^(?:\p{Regional_Indicator}{2}|(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0E|\uFE0F)?(?:\p{Emoji_Modifier})?(?:\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0E|\uFE0F)?(?:\p{Emoji_Modifier})?)*)$/u,
    {
      message: 'Tercih edilen emoji yalnızca tek bir emoji içermelidir.',
    },
  )
  preferredEmoji?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => KnowledgeFaqDto)
  faqs?: KnowledgeFaqDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => AiInstructionDto)
  instructions?: AiInstructionDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChannelKnowledgeOverrideDto)
  channelOverrides?: ChannelKnowledgeOverrideDto[];
}
