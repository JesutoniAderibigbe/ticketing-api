import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString } from 'class-validator';
import { EventStatus } from '../entities/event-status.enum';

export class UpdateEventDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  venue?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startsAt?: Date;

  @IsEnum(EventStatus, {
    message: 'status must be draft, published, or cancelled',
  })
  @IsOptional()
  status?: EventStatus;
}
