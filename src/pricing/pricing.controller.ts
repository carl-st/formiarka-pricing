// src/pricing/pricing.controller.ts
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import * as path from "path";
import * as fs from "fs";
import { CuraService } from "./cura.service";
import { PricingService } from "./pricing.service";
import { SliceOptionsDto } from "./dto/slice-options.dto";

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

@Controller("pricing")
export class PricingController {
  constructor(
    private readonly cura: CuraService,
    private readonly pricing: PricingService,
  ) {}

  @Post("quote")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dest = path.join(process.cwd(), "tmp", "uploads");
          ensureDir(dest);
          cb(null, dest);
        },
        filename: (req, file, cb) => {
          cb(null, `${Date.now()}-${file.originalname}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.toLowerCase().endsWith(".stl"))
          return cb(
            new BadRequestException("Only .stl files are allowed"),
            false,
          );
        cb(null, true);
      },
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async quote(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: SliceOptionsDto & { material?: string },
  ) {
    if (!file) throw new BadRequestException("No file uploaded");

    const outDir = path.join(process.cwd(), "tmp", "gcode");
    ensureDir(outDir);

    const gcodePath = await this.cura.slice(file.path, outDir, {
      layerHeight: body.layerHeight,
      infillPct: body.infillPct,
      printSpeed: body.printSpeed,
      filamentDiameter: body.filamentDiameter,
      nozzleDiameter: body.nozzleDiameter,
    });

    // Load rates (could be from process.env or config file)
    const ratesPath =
      process.env.RATES_PATH ||
      path.join(process.cwd(), "config", "rates.json");
    const rates = JSON.parse(fs.readFileSync(ratesPath, "utf8"));

    const breakdown = this.pricing.compute(gcodePath, rates, {});
    return breakdown;
  }
}
