import {
  Controller,
  Post,
  BadRequestException,
  Body,
  Logger,
  Param,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { PricingService } from "./pricing.service";
import { PriceRequestDto } from "./dto/price-request.dto";

@ApiTags("pricing")
@Controller("pricing")
export class PricingController {
  private readonly logger = new Logger(PricingController.name);
  constructor(private readonly pricing: PricingService) {}

  @Post("stl")
  @ApiOperation({ summary: "Calculate price from an STL file URL" })
  @ApiBody({
    description: "STL file URL and pricing options",
    schema: {
      type: "object",
      required: ["fileUrl", "quality", "infill", "originalFilename"],
      properties: {
        fileUrl: {
          type: "string",
          description: "URL of the STL file to download",
        },
        options: {
          type: "object",
          description: "Pricing options for the STL file",
          properties: {
            quality: {
              type: "string",
              enum: ["standard", "medium", "premium"],
              description: "Print quality level",
            },
            infill: {
              type: "string",
              enum: ["standard", "medium", "premium"],
              description: "Infill percentage level",
            },
            originalFilename: {
              type: "string",
              description: "Original filename of the STL file",
            },
          },
        },
      },
    },
  })
  /**
   * Downloads an STL file from a remote URL, saves it to the temp directory,
   * and calculates the price.
   * @param fileUrl URL of the file to download
   * @param options Pricing options
   * @returns Price breakdown
   * @throws BadRequestException if download fails or content type is invalid
   */
  async downloadAndPrice(
    @Body() body: { fileUrl: string; options: PriceRequestDto },
  ) {
    const { fileUrl, options } = body;
    this.logger.log(
      `Received request to price STL from URL: ${fileUrl} with options: ${JSON.stringify(
        options,
      )}`,
    );
    // Validate URL
    let url: URL;
    try {
      url = new URL(fileUrl);
    } catch {
      throw new BadRequestException("Invalid fileUrl provided");
    }

    if (!url.protocol.startsWith("http")) {
      throw new BadRequestException("fileUrl must be an HTTP or HTTPS URL");
    }

    // Download file from URL
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new BadRequestException(
        `Failed to download file: HTTP ${response.status}`,
      );
    }

    const contentType = response.headers.get("content-type");
    if (
      !contentType?.includes("application/sla") &&
      !contentType?.includes("model")
    ) {
      this.logger.warn(`Unexpected content type for STL file: ${contentType}`);
    }

    const tmpDir = process.env.TMP_DIR || "/tmp";
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const tempFilename = `upload-${unique}.stl`;
    const tempPath = `${tmpDir}/${tempFilename}`;

    // Stream the file to disk
    const fileStream = createWriteStream(tempPath);
    await pipeline(Readable.from(response.body as any), fileStream);

    this.logger.log(
      `Downloaded ${options.originalFilename} to ${tempFilename} with options: ${JSON.stringify(
        options,
      )}`,
    );

    // Calculate price using the downloaded file
    return await this.pricing.priceFromStl(tempFilename, options);
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

    if (!options.originalFilename) {
      throw new BadRequestException(
        "Missing required parameters: originalFilename.",
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
