import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as crypto from "crypto";
import { ConfigService } from "../config/config.service";
import { PriceBreakdown, Customer } from "./../pricing/dto/price-breakdown.dto";
import { PriceRequestDto } from "./../pricing/dto/price-request.dto";
import { createAdminApiClient } from "@shopify/admin-api-client";
import type { AdminApiClient } from "@shopify/admin-api-client";
import { ApiVersion } from "@shopify/shopify-api";

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
      `Creating Shopify draft order for ${priceBreakdown.originalFilename} for customer ${customer.email}`,
    );

    // Note on file uploads: Shopify's GraphQL API for Draft Orders doesn't directly
    // support file attachments on line items. A common pattern is to upload the
    // file to Shopify's file storage first (using the `fileCreate` mutation)
    // and then reference the returned file GID in a custom attribute on the line item.
    // For simplicity, we'll just add the filename as a property for now.

    const customAttributes: { key: string; value: string }[] = [];
    const addAttribute = (key: string, value: any) => {
      if (value !== null && value !== undefined && value !== "") {
        customAttributes.push({ key, value: String(value) });
      }
    };

    if (uploadedFileUrl) {
      addAttribute("Uploaded STL File URL", uploadedFileUrl);
    }

    if (priceBreakdown) {
      addAttribute("Material", `${priceBreakdown.filamentG.toFixed(2)}g`);
      addAttribute(
        "Print Time",
        `${(priceBreakdown.printTimeSeconds / 3600).toFixed(2)} hours`,
      );
      addAttribute("Original STL File Name", priceBreakdown.originalFilename);
      addAttribute(
        "Material Cost",
        `${priceBreakdown.materialCost.toFixed(2)} PLN`,
      );
      addAttribute(
        "Energy Cost",
        `${priceBreakdown.energyCost.toFixed(2)} PLN`,
      );
      addAttribute(
        "Maintenance Cost",
        `${priceBreakdown.maintenanceCost.toFixed(2)} PLN`,
      );
      addAttribute(
        "Markup",
        `${priceBreakdown.markupAmount.toFixed(2)} PLN (${priceBreakdown.markupPct}%)`,
      );
    }

    if (options) {
      addAttribute("Quality", options.quality);
      addAttribute("Infill", options.infill);
    }

    if (customer) {
      addAttribute("Filament Type", customer.filamentType);
      addAttribute("Color", customer.color);
      addAttribute("Amount", customer.amount);
      addAttribute("Delivery", customer.delivery);
      addAttribute("Payment", customer.payment);
      addAttribute("Invoice Required", customer.invoice);
      addAttribute("Terms Accepted", customer.terms);
    }

    const draftOrderInput: any = {
      lineItems: [
        {
          title: `3D Print - ${customer.firstName} ${customer.lastName} ${priceBreakdown.originalFilename}`,
          originalUnitPrice: priceBreakdown.totalPrintCost.toFixed(2),
          quantity: 1,
          customAttributes: customAttributes,
        },
      ],
      shippingLine: {
        shippingRateHandle: "inpost_paczkomat",
        title: "InPost Paczkomat",
        priceWithCurrency: {
          amount: "16.99",
          currencyCode: "PLN",
        },
      },
    };

    if (customer) {
      draftOrderInput.email = customer.email;
      draftOrderInput.note = customer.notes;
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
    }

    try {
      this.logger.debug(
        `Sending GraphQL request to: "https://${this.configService.shopifyShopName}/admin/api/${this.configService.shopifyApiVersion}/graphql.json"`,
      );
      const response = await this.client.request(
        `mutation draftOrderCreate($input: DraftOrderInput!) {
          draftOrderCreate(input: $input) {
            draftOrder {
              id
              invoiceUrl
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            input: draftOrderInput,
          },
        },
      );

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
      const response = await this.client.request(
        `query draftOrder($id: ID!) {
          draftOrder(id: $id) {
            id
            status
          }
        }`,
        {
          variables: {
            id: draftOrderId,
          },
        },
      );

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
