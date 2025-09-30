import {
  Controller,
  Post,
  Body,
  Logger,
  BadRequestException,
  Get,
  Param,
  Req,
  Headers,
} from "@nestjs/common";
import { ApiOperation, ApiTags, ApiExcludeEndpoint } from "@nestjs/swagger";
import { ShopifyService } from "./shopify.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { PricingService } from "../pricing/pricing.service";
import { promises as fs } from "fs";
import { join } from "path";
import { EventsGateway } from "../events/events.gateway";
import type { Request } from "express";

@ApiTags("shopify")
@Controller("shopify")
export class ShopifyController {
  private readonly logger = new Logger(ShopifyController.name);

  constructor(
    private readonly shopifyService: ShopifyService,
    private readonly pricingService: PricingService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  @Post("create-order")
  @ApiOperation({ summary: "Create a Shopify order from a priced file" })
  async createOrder(@Body() createOrderDto: CreateOrderDto) {
    this.logger.log(
      `Creating Shopify order for file: ${
        createOrderDto.filename
      } with options: ${JSON.stringify(createOrderDto.options)}`,
    );

    const { filename, options, customer } = createOrderDto;

    if (!filename || !options || !options.quality || !options.infill) {
      throw new BadRequestException(
        "Missing required parameters: filename, quality, and infill.",
      );
    }

    const tmpDir = process.env.TMP_DIR || "/tmp";
    const stlPath = join(tmpDir, filename);

    try {
      await fs.access(stlPath);
    } catch (error) {
      this.logger.error(`File not found at ${stlPath}`);
      throw new BadRequestException(
        `File ${filename} not found. It may have been temporary and is now deleted.`,
      );
    }

    const priceBreakdown = await this.pricingService.priceFromStl(
      stlPath,
      options,
    );

    const shopifyOrder = await this.shopifyService.createOrder(
      priceBreakdown,
      customer,
      options,
    );

    return {
      message: "Shopify order created successfully",
      order: shopifyOrder,
    };
  }

  @Get("order-status/:draftOrderId")
  @ApiOperation({
    summary: "Check the payment status of a Shopify draft order",
  })
  async getOrderStatus(@Param("draftOrderId") draftOrderId: string) {
    this.logger.log(`Checking status for draft order: ${draftOrderId}`);

    const status = await this.shopifyService.getOrderStatus(draftOrderId);
    return {
      message: "Order status retrieved successfully",
      status: status,
    };
  }

  @Post("webhook")
  @ApiExcludeEndpoint()
  async handleWebhook(
    @Headers("x-shopify-hmac-sha256") hmac: string,
    @Req() req: Request,
    @Body() body: any,
  ) {
    this.logger.log(
      `Received Shopify webhook for topic ${req.headers["x-shopify-topic"] || "unknown"}`,
    );

    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      throw new BadRequestException(
        "Missing raw body for webhook verification",
      );
    }

    const isValid = this.shopifyService.verifyWebhook(hmac, rawBody);

    if (!isValid) {
      this.logger.warn("Invalid webhook signature");
      throw new BadRequestException("Invalid webhook signature");
    }

    this.logger.log("Webhook signature verified");

    // Process the webhook
    const { draft_order_id, id, financial_status } = body;

    if (financial_status === "paid" && draft_order_id) {
      this.logger.log(`Order ${id} for draft order ${draft_order_id} is paid.`);
      const draftOrderGid = `gid://shopify/DraftOrder/${draft_order_id}`;
      this.eventsGateway.emitOrderStatusUpdate(draftOrderGid, {
        status: "PAID",
        orderId: id,
      });
    }

    return { message: "Webhook received" };
  }
}
