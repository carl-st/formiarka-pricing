import { ApiProperty } from "@nestjs/swagger";

export class CreatePriceRequestDto {
  @ApiProperty({ type: "string", format: "binary", required: true })
  file: Express.Multer.File;

  @ApiProperty({ description: "Cost per gram of filament in currency units." })
  filamentCostPerGram: number;

  @ApiProperty({ description: "Cost per hour of printing in currency units." })
  printerCostPerHour: number;

  @ApiProperty({
    description: "Optional infill percentage for the print.",
    required: false,
    default: 20,
  })
  infill: number;
}
