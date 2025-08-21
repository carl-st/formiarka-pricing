import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { PrintService } from "./print-price.service";
import { CreatePriceRequestDto } from "./dto/create-price-request.dto";
import { ApiConsumes, ApiBody } from "@nestjs/swagger";

@Controller("print")
export class PrintController {
  constructor(private readonly printService: PrintService) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    description:
      "Upload STL file and provide cost parameters to calculate print price.",
    type: CreatePriceRequestDto,
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() createPriceRequestDto: CreatePriceRequestDto,
  ) {
    if (!file) {
      throw new BadRequestException("STL file is required.");
    }

    const { filamentCostPerGram, printerCostPerHour, infill } =
      createPriceRequestDto;

    if (!filamentCostPerGram || !printerCostPerHour) {
      throw new BadRequestException(
        "Filament cost per gram and printer cost per hour are required.",
      );
    }

    return this.printService.calculatePrice(
      file,
      +filamentCostPerGram,
      +printerCostPerHour,
      +infill,
    );
  }
}
