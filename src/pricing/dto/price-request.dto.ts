import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";

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
  @ApiProperty({
    enum: Quality,
    default: Quality.MEDIUM,
    description: "The quality of the print.",
  })
  @IsEnum(Quality)
  quality: Quality = Quality.MEDIUM;

  @ApiProperty({
    enum: Infill,
    default: Infill.MEDIUM,
    description: "The infill percentage for the print.",
  })
  @IsEnum(Infill)
  infill: Infill = Infill.MEDIUM;

  @ApiProperty({
    type: String,
    description: "The original filename for the print.",
  })
  originalFilename: string;
}
