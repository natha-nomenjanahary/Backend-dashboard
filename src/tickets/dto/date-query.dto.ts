import { IsInt, Min, Max } from 'class-validator';

export class DateQueryDto {
  @IsInt()
  @Min(1)
  @Max(12)
  mois: number;

  @IsInt()
  @Min(2000)
  annee: number;
}