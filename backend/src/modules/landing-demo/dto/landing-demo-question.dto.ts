import { Transform, type TransformFnParams } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class LandingDemoQuestionDto {
  @IsString()
  productId: string;

  @Transform(trim)
  @IsString()
  @MinLength(4)
  @MaxLength(240)
  question: string;
}
