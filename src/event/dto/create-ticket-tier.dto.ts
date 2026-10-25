import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateTicketTierDto {
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsInt()
  @Min(0)
  priceKobo?: number;

  @IsInt()
  @Min(1)
  quantityTotal?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxPerOrder?: number;
}
