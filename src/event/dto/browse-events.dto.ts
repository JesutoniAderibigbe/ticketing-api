import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class BrowseEventsDto {
  @IsString()
  @IsOptional()
  search?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startsAtFrom?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startsAtTo?: Date;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number;
}
