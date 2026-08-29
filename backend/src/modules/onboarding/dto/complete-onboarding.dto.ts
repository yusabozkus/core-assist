import { Transform, type TransformFnParams } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown);
}

export enum OnboardingChannel {
  TRENDYOL = 'TRENDYOL',
  HEPSIBURADA = 'HEPSIBURADA',
}

export class CompleteOnboardingDto {
  @Transform(trimString)
  @IsString()
  @Length(2, 80)
  storeName: string;

  @IsOptional()
  @IsEnum(OnboardingChannel)
  selectedChannel?: OnboardingChannel;
}
