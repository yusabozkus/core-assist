import { Transform, type TransformFnParams } from 'class-transformer';
import { IsString, Length } from 'class-validator';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown);
}

export class AnswerProductQuestionDto {
  @Transform(trimString)
  @IsString()
  @Length(2, 2000)
  answer: string;
}
