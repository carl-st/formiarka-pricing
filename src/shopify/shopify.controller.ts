import {
  Controller,
  Post,
  Body,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { ShopifyService } from "./shopify.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { PricingService } from "../pricing/pricing.service";
import { promises as fs } from "fs";
import { join } from "path";

@Controller("shopify")
export class ShopifyController {
  private readonly logger = new Logger(ShopifyController.name);

  constructor(
    private readonly shopifyService: ShopifyService,
    private readonly pricingService: PricingService
  ) {}

  @Post("create-order")
  async createOrder(@Body() createOrderDto: CreateOrderDto) {
    this.logger.log(
      `Creating Shopify order for file: ${
        createOrderDto.filename
      } with options: ${JSON.stringify(createOrderDto.options)}`
    );

    const { filename, options } = createOrderDto;

    if (!filename || !options || !options.quality || !options.infill) {
      throw new BadRequestException(
        "Missing required parameters: filename, quality, and infill."
      );
    }

    const tmpDir = process.env.TMP_DIR || "/tmp";
    const stlPath = join(tmpDir, filename);

    try {
      await fs.access(stlPath);
    } catch (error) {
      this.logger.error(`File not found at ${stlPath}`);
      throw new BadRequestException(
        `File ${filename} not found. It may have been temporary and is now deleted.`
      );
    }

    const priceBreakdown = await this.pricingService.priceFromStl(
      stlPath,
      options
    );

    const shopifyOrder = await this.shopifyService.createOrder(
      priceBreakdown,
      filename,
      stlPath
    );

    return {
      message: "Shopify order created successfully",
      order: shopifyOrder,
    };
  }
}
