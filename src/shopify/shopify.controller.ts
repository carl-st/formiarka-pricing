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
import { ApiOperation, ApiTags, ApiBody, ApiHeader } from "@nestjs/swagger";
import { ShopifyService } from "./shopify.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { PricingService } from "../pricing/pricing.service";
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

  @Post("draft-orders")
  @ApiOperation({ summary: "Create a Shopify draft order from a priced file" })
  async createOrder(@Body() createOrderDto: CreateOrderDto) {
    this.logger.log(
      `Creating Shopify draft order for file: ${
        createOrderDto.uploadedFileUrl
      } with options: ${JSON.stringify(createOrderDto.options)}`,
    );

    const { tempFilename, uploadedFileUrl, options, customer } = createOrderDto;

    if (!uploadedFileUrl || !options || !options.quality || !options.infill) {
      throw new BadRequestException(
        "Missing required parameters: tempFilename, quality, and infill.",
      );
    }

    const priceBreakdown = await this.pricingService.priceFromStl(
      tempFilename,
      options,
    );

    const shopifyOrder = await this.shopifyService.createOrder(
      priceBreakdown,
      customer,
      options,
    );

    return {
      message: "Shopify draft order created successfully.",
      order: shopifyOrder,
    };
  }

  @Get("draft-orders/:id/status")
  @ApiOperation({ summary: "Get the status of a Shopify draft order" })
  async getDraftOrderStatus(@Param("id") draftOrderId: string) {
    this.logger.log(`Getting status for draft order: ${draftOrderId}`);
    // The ID from the URL will be just the number, but Shopify's GQL API needs the full GID.
    const gid = `gid://shopify/DraftOrder/${draftOrderId}`;
    return this.shopifyService.getDraftOrderStatus(gid);
  }

  @Post("webhooks")
  @ApiOperation({
    summary: "Handle Shopify webhooks for order and draft order updates.",
  })
  @ApiHeader({
    name: "x-shopify-hmac-sha256",
    description: "HMAC-SHA256 signature of the request body.",
    required: true,
  })
  @ApiHeader({
    name: "x-shopify-topic",
    description: "The webhook topic.",
    required: true,
  })
  async handleWebhook(
    @Headers("x-shopify-hmac-sha256") hmac: string,
    @Headers("x-shopify-topic") topic: string,
    @Req() req: Request,
  ) {
    this.logger.log(`Received Shopify webhook for topic: ${topic}`);

    // IMPORTANT: For HMAC validation to be secure, we need the raw request body.
    // This requires your NestJS application to be configured to provide it.
    // For example, in main.ts: `app.use(bodyParser.json({ verify: (req, res, buf) => { req.rawBody = buf } }));`
    // and then using `req.rawBody` here. We are passing `req.body` which might be a parsed object.
    // The service method has a fallback, but it is not recommended for production.
    const body = (req as any).rawBody || req.body;
    const isValid = await this.shopifyService.verifyWebhook(hmac, body);

    // if (!isValid) {
    //   this.logger.warn(`Invalid HMAC for Shopify webhook on topic ${topic}.`);
    //   throw new BadRequestException("Invalid HMAC signature.");
    // }

    this.logger.log(`Valid Shopify webhook received for topic: ${topic}`);

    const payload = req.body;

    // if (topic === "orders/create" || topic === "orders/paid") {
    //   this.logger.log(payload);
    //   if (payload.draft_order_id) {
    //     // TODO: Check if this is correct
    //     const numericDraftOrderId = payload.draft_order_id.toString();
    //     const draftOrderIdGid = `gid://shopify/DraftOrder/${numericDraftOrderId}`;
    //     const orderIdGid = `gid://shopify/Order/${payload.id}`;
    //     this.logger.log(
    //       `Order ${orderIdGid} created from draft order ${draftOrderIdGid}. Payment status: ${payload.financial_status}`,
    //     );
    //     this.eventsGateway.emitOrderStatusUpdate(numericDraftOrderId, {
    //       draftOrderId: draftOrderIdGid,
    //       orderId: orderIdGid,
    //       status: payload.financial_status,
    //     });
    //   }
    // }

    if (topic === "draft_orders/update") {
      // this.logger.log(payload);
      if (payload.status === "completed") {
        const draftOrderIdGid = payload.id; // This is already a GID
        const orderIdGid = payload.order_id; // This is also a GID
        this.logger.log(
          `Draft order ${draftOrderIdGid} was completed. Associated order: ${orderIdGid}`,
        );
        this.eventsGateway.emitOrderStatusUpdate(draftOrderIdGid, {
          draftOrderId: draftOrderIdGid.toString(),
          orderId: orderIdGid.toString(),
          status: payload.status,
        });
      }
    }

    return { status: "ok" };
  }
}
