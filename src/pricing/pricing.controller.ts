import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Body,
  Logger,
  Param,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { promises as fs } from "fs";
import { PricingService } from "./pricing.service";
import { PriceRequestDto } from "./dto/price-request.dto";

@ApiTags("pricing")
@Controller("pricing")
export class PricingController {
  private readonly logger = new Logger(PricingController.name);
  constructor(private readonly pricing: PricingService) {}

  @Post("stl")
  @ApiOperation({ summary: "Calculate price from an STL file" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    description: "STL file and pricing options",
    type: PriceRequestDto,
  })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: async (req, file, cb) => {
          const tmpDir = process.env.TMP_DIR || "/tmp";
          cb(null, tmpDir);
        },
        filename: (req, file, cb) => {
          const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
          cb(null, `upload-${unique}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.toLowerCase().endsWith(".stl")) {
          return cb(
            new BadRequestException("Only .stl files are allowed"),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  )
  async priceFromStl(
    @UploadedFile() file: Express.Multer.File,
    @Body() options: PriceRequestDto,
  ) {
    this.logger.log(
      `Pricing ${file.originalname} with options: ${JSON.stringify(options)}`,
    );

    if (!file) throw new BadRequestException("No file provided");
    if (!options.quality || !options.infill || !options.originalFilename) {
      throw new BadRequestException(
        "Missing required parameters: quality, infill, and originalFilename.",
      );
    }

    try {
      return await this.pricing.priceFromStl(file.filename, options);
    } finally {
      // The file is no longer deleted, so it can be used for recalculation.
      // try {
      //   await fs.unlink(stlPath);
      // } catch {
      //   // ignore
      // }
    }
  }

  @Post("recalculate/:tempFilename")
  @ApiOperation({ summary: "Recalculate price for an existing file" })
  @HttpCode(HttpStatus.OK)
  async recalculatePrice(
    @Param("tempFilename") tempFilename: string,
    @Body() options: PriceRequestDto,
  ) {
    this.logger.log(
      `Recalculating price for ${tempFilename} with options: ${JSON.stringify(
        options,
      )}`,
    );

    if (!options.quality || !options.infill) {
      throw new BadRequestException(
        "Missing required parameters: quality and infill.",
      );
    }

    const breakdown = await this.pricing.priceFromStl(tempFilename, options);
    return {
      originalFilename: options.originalFilename,
      tempFilename: tempFilename,
      ...breakdown,
    };
  }
}
