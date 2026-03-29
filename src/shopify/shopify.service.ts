import { Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";
import { ConfigService } from "../config/config.service";
import { PriceBreakdown, Customer } from "./../pricing/dto/price-breakdown.dto";
import { PriceRequestDto } from "./../pricing/dto/price-request.dto";
import { createAdminApiClient } from "@shopify/admin-api-client";
import type { AdminApiClient } from "@shopify/admin-api-client";
import { ApiVersion } from "@shopify/shopify-api";
import {
  DraftOrderInput,
  CustomAttribute,
} from "./interfaces/draft-order.interface";
import { addAttribute } from "./utils/attributes.util";
import {
  DRAFT_ORDER_CREATE_MUTATION,
  DRAFT_ORDER_QUERY,
} from "./graphql/queries";

@Injectable()
export class ShopifyService {
  private readonly logger = new Logger(ShopifyService.name);
  private readonly client: AdminApiClient;

  constructor(private readonly configService: ConfigService) {
    const storeDomain = this.configService.shopifyShopName;
    const accessToken = this.configService.shopifyAdminApiToken;

    this.logger.debug(
      `Initializing Shopify Client with storeDomain: ${storeDomain}`,
    );
    if (!accessToken) {
      this.logger.error("Shopify Admin API Token is missing!");
    } else {
      this.logger.debug(
        `Shopify Admin API Token loaded (first 5 chars): ${accessToken.substring(
          0,
          5,
        )}`,
      );
    }

    this.client = createAdminApiClient({
      storeDomain: storeDomain,
      apiVersion: ApiVersion.July25,
      accessToken: accessToken,
    });
  }

  async createOrder(
    uploadedFileUrl: string,
    priceBreakdown: PriceBreakdown,
    customer: Partial<Customer>,
    options: PriceRequestDto,
  ): Promise<any> {
    this.logger.log(
      `Creating Shopify draft order for ${priceBreakdown.originalFilename} for customer ${customer?.email || "unknown"}`,
    );

    // Note on file uploads: Shopify's GraphQL API for Draft Orders doesn't directly
    // support file attachments on line items. A common pattern is to upload the
    // file to Shopify's file storage first (using the `fileCreate` mutation)
    // and then reference the returned file GID in a custom attribute on the line item.
    // For simplicity, we'll just add the filename as a property for now.

    const customAttributes: CustomAttribute[] = [];

    this.addAttributesFromUploadedFile(uploadedFileUrl, customAttributes);
    this.addAttributesFromPriceBreakdown(priceBreakdown, customAttributes);
    this.addAttributesFromOptions(options, customAttributes);
    this.addAttributesFromCustomer(customer, customAttributes);

    const draftOrderInput = this.createDraftOrderInput(
      customer,
      priceBreakdown,
      customAttributes,
    );

    return this.executeDraftOrderCreation(draftOrderInput);
  }

  private addAttributesFromUploadedFile(
    uploadedFileUrl: string,
    customAttributes: CustomAttribute[],
  ): void {
    if (uploadedFileUrl) {
      addAttribute(customAttributes, "Uploaded STL File URL", uploadedFileUrl);
    }
  }

  private addAttributesFromPriceBreakdown(
    priceBreakdown: PriceBreakdown,
    customAttributes: CustomAttribute[],
  ): void {
    if (!priceBreakdown) return;

    const attributes = [
      ["Original STL File Name", priceBreakdown.originalFilename],
      ["Material", `${priceBreakdown.filamentG.toFixed(2)}g`],
      [
        "Print Time",
        `${(priceBreakdown.printTimeSeconds / 3600).toFixed(2)} hours`,
      ],
      ["Material Cost", `${priceBreakdown.materialCost.toFixed(2)} PLN`],
      ["Energy Cost", `${priceBreakdown.energyCost.toFixed(2)} PLN`],
      ["Maintenance Cost", `${priceBreakdown.maintenanceCost.toFixed(2)} PLN`],
      [
        "Markup",
        `${priceBreakdown.markupAmount.toFixed(2)} PLN (${priceBreakdown.markupPct}%)`,
      ],
    ];

    attributes.forEach(([key, value]) =>
      addAttribute(customAttributes, key, value),
    );
  }

  private addAttributesFromOptions(
    options: PriceRequestDto,
    customAttributes: CustomAttribute[],
  ): void {
    if (!options) return;

    const attributes = [
      ["Quality", options.quality],
      ["Infill", options.infill],
    ];

    attributes.forEach(([key, value]) =>
      addAttribute(customAttributes, key, value),
    );
  }

  private addAttributesFromCustomer(
    customer: Partial<Customer>,
    customAttributes: CustomAttribute[],
  ): void {
    if (!customer) return;

    const customerAttributes: Array<[string, string | boolean | undefined]> = [
      ["Filament Type", customer.filamentType],
      ["Color", customer.color],
      ["Amount", customer.amount?.toString()],
      ["Delivery", customer.delivery],
      ["Payment", customer.payment],
      ["Invoice Required", customer.invoice],
      ["Terms Accepted", customer.terms],
    ];

    customerAttributes.forEach(([key, value]) =>
      addAttribute(customAttributes, key, value),
    );

    if (customer.lockerData) {
      const lockerAttributes = [
        ["Locker Name", customer.lockerData.name],
        ["Locker Address Line 1", customer.lockerData.address.line1],
        ["Locker Address Line 2", customer.lockerData.address.line2],
        ["Locker City", customer.lockerData.address.city],
        ["Locker Postal Code", customer.lockerData.address.countryCode],
      ];

      lockerAttributes.forEach(([key, value]) =>
        addAttribute(customAttributes, key, value),
      );
    }
  }

  private createDraftOrderInput(
    customer: Partial<Customer>,
    priceBreakdown: PriceBreakdown,
    customAttributes: CustomAttribute[],
  ): DraftOrderInput {
    if (!customer) {
      throw new Error("Invalid delivery method");
    }

    const draftOrderInput: DraftOrderInput = {
      lineItems: [
        {
          title: `3D Print - ${customer.firstName} ${customer.lastName}: ${priceBreakdown.originalFilename}`,
          originalUnitPrice: priceBreakdown.totalPrintCost.toFixed(2),
          quantity: 1,
          customAttributes: customAttributes,
          requiresShipping: true,
        },
      ],
    };

    draftOrderInput.email = customer.email;
    draftOrderInput.note = customer.notes;
    draftOrderInput.billingAddress = {
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      address1: customer.address1,
      address2: customer.address2,
      city: customer.city,
      zip: customer.zip,
      countryCode: customer.countryCode,
      company: customer.company,
    };

    if (customer.delivery === "InPost Paczkomat" && customer.lockerData) {
      draftOrderInput.shippingLine = {
        title: `InPost Paczkomat ${customer.lockerData?.name}`,
        price: customer.shippingCost?.toString() || "0",
      };
      draftOrderInput.shippingAddress = {
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        address1: customer.address1,
        address2: customer.address2,
        city: customer.city,
        zip: customer.zip,
        countryCode: customer.countryCode,
        company: customer.company,
      };
    }

    return draftOrderInput;
  }

  private async executeDraftOrderCreation(
    draftOrderInput: DraftOrderInput,
  ): Promise<any> {
    try {
      this.logger.debug(
        `Sending GraphQL request to: "https://${this.configService.shopifyShopName}/admin/api/${this.configService.shopifyApiVersion}/graphql.json"`,
      );
      const response = await this.client.request(DRAFT_ORDER_CREATE_MUTATION, {
        variables: {
          input: draftOrderInput,
        },
      });

      if (response.errors) {
        this.logger.error("GraphQL errors from Shopify API:", response.errors);
        throw new Error("Failed to create Shopify draft order.");
      }

      if (response.data.draftOrderCreate.userErrors.length > 0) {
        this.logger.error(
          "Error creating Shopify draft order:",
          response.data.draftOrderCreate.userErrors,
        );
        throw new Error("Failed to create Shopify draft order.");
      }

      this.logger.log(
        "Shopify draft order created:",
        response.data.draftOrderCreate.draftOrder,
      );
      return response.data.draftOrderCreate.draftOrder;
    } catch (error) {
      this.logger.error(
        `Error calling Shopify API: ${error.message}`,
        error.stack,
      );
      if (error.cause) {
        this.logger.error("Underlying cause of the error:", error.cause);
      }
      throw error;
    }
  }

  async verifyWebhook(hmac: string, body: Buffer | object): Promise<boolean> {
    // IMPORTANT: This validation requires the raw request body.
    // If 'body' is an object, it's assumed to be parsed JSON, which is not secure for HMAC validation.
    // Your application should be configured to provide the raw body for this webhook endpoint.
    const secret = this.configService.shopifySharedSecret;
    if (!secret) {
      this.logger.error("Shopify webhook secret is not configured.");
      return false;
    }

    const rawBody = Buffer.isBuffer(body)
      ? body.toString("utf8")
      : JSON.stringify(body);

    if (!Buffer.isBuffer(body)) {
      this.logger.warn(
        "HMAC validation is being performed on a stringified object. This is not recommended for production. Please configure raw body parsing for webhooks.",
      );
    }

    const generatedHmac = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf-8")
      .digest("base64");

    try {
      return crypto.timingSafeEqual(
        Buffer.from(hmac),
        Buffer.from(generatedHmac),
      );
    } catch (e) {
      this.logger.error(
        `Error during HMAC comparison: ${e.message}. This can happen if the HMACs have different lengths.`,
      );
      return false;
    }
  }

  async getDraftOrderStatus(draftOrderId: string): Promise<any> {
    this.logger.log(`Fetching status for draft order ${draftOrderId}`);
    try {
      const response = await this.client.request(DRAFT_ORDER_QUERY, {
        variables: {
          id: draftOrderId,
        },
      });

      if (response.errors) {
        this.logger.error("GraphQL errors from Shopify API:", response.errors);
        throw new Error(
          `Failed to fetch draft order status for ${draftOrderId}.`,
        );
      }

      if (response.data.draftOrderCreate?.userErrors?.length > 0) {
        this.logger.error(
          "Error fetching draft order status:",
          response.data.draftOrderCreate.userErrors,
        );
        throw new Error(
          `Failed to fetch draft order status for ${draftOrderId}.`,
        );
      }

      return response.data.draftOrder;
    } catch (error) {
      this.logger.error(
        `Error calling Shopify API for draft order status: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
