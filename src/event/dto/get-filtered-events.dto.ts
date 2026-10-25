import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EventStatus } from '../entities/event-status.enum';

export class GetFilteredEventsDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  venue?: string;

  @IsEnum(EventStatus, {
    message: 'status must be draft, published, or cancelled',
  })
  @IsOptional()
  status?: EventStatus;
}
