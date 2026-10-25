import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsString } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsString()
  @IsNotEmpty()
  venue?: string;

  @Type(() => Date)
  @IsDate()
  startsAt?: Date;
}
