import { IsEnum, IsOptional } from "class-validator";

export enum Quality {
  STANDARD = "standard",
  MEDIUM = "medium",
  PREMIUM = "premium",
}

export enum Infill {
  STANDARD = "standard",
  MEDIUM = "medium",
  PREMIUM = "premium",
}

export class PriceRequestDto {
  @IsEnum(Quality)
  @IsOptional()
  quality: Quality = Quality.MEDIUM;

  @IsEnum(Infill)
  @IsOptional()
  infill: Infill = Infill.MEDIUM;
}
