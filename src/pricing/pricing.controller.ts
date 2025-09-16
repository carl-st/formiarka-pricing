import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Body,
  Logger,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { promises as fs } from "fs";
import { PricingService } from "./pricing.service";
import { PriceRequestDto } from "./dto/price-request.dto";

@Controller("pricing")
export class PricingController {
  private readonly logger = new Logger(PricingController.name);
  constructor(private readonly pricing: PricingService) {}

  @Post("stl")
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
            false
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    })
  )
  async priceFromStl(
    @UploadedFile() file: Express.Multer.File,
    @Body() options: PriceRequestDto
  ) {
    this.logger.log(
      `Pricing ${file.originalname} with options: ${JSON.stringify(options)}`
    );
    if (!file) throw new BadRequestException("No file provided");
    const stlPath = join(file.destination, file.filename);
    try {
      const breakdown = await this.pricing.priceFromStl(stlPath, options);
      return {
        filename: file.originalname,
        ...breakdown,
      };
    } finally {
      try {
        await fs.unlink(stlPath);
      } catch {
        // ignore
      }
    }
  }
}
