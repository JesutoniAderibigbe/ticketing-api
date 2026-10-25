import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateTicketTierDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  priceKobo?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  quantityTotal?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxPerOrder?: number;
}
