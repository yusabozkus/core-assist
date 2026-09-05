import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';

export class GlobalSearchQueryDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 100)
  query: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  limit: number = 5;
}
