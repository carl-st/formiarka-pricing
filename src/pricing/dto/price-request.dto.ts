import { IsEnum, IsOptional } from "class-validator";

export enum Quality {
  DRAFT = "draft",
  NORMAL = "normal",
  FINE = "fine",
}

export enum Infill {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

export class PriceRequestDto {
  @IsEnum(Quality)
  @IsOptional()
  quality: Quality = Quality.NORMAL;

  @IsEnum(Infill)
  @IsOptional()
  infill: Infill = Infill.MEDIUM;
}
