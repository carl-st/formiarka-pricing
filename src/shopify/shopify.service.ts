import { Injectable, Logger } from "@nestjs/common";
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
      `Initializing Shopify Client with storeDomain: ${storeDomain}`
    );
    if (!accessToken) {
      this.logger.error("Shopify Admin API Token is missing!");
    } else {
      this.logger.debug(
        `Shopify Admin API Token loaded (first 5 chars): ${accessToken.substring(
          0,
          5
        )}`
      );
    }

    this.client = createAdminApiClient({
      storeDomain: storeDomain,
      apiVersion: ApiVersion.July25,
      accessToken: accessToken,
    });
  }

  async createOrder(
    priceBreakdown: PriceBreakdown,
    customer: Partial<Customer>,
    options: PriceRequestDto
  ): Promise<any> {
    this.logger.log(
      `Creating Shopify draft order for ${priceBreakdown.originalFilename} for customer ${customer.email}`
    );

    // Note on file uploads: Shopify's GraphQL API for Draft Orders doesn't directly
    // support file attachments on line items. A common pattern is to upload the
    // file to Shopify's file storage first (using the `fileCreate` mutation)
    // and then reference the returned file GID in a custom attribute on the line item.
    // For simplicity, we'll just add the filename as a property for now.

    const customAttributes = [
      {
        key: "Material",
        value: `${priceBreakdown.filamentG.toFixed(2)}g`,
      },
      {
        key: "Print Time",
        value: `${(priceBreakdown.printTimeSeconds / 3600).toFixed(2)} hours`,
      },
      {
        key: "Original STL Filename",
        value: priceBreakdown.originalFilename,
      },
      {
        key: "Temporary STL Filename",
        value: priceBreakdown.tempFilename,
      },
      {
        key: "Material Cost",
        value: `${priceBreakdown.materialCost.toFixed(2)} PLN`,
      },
      {
        key: "Energy Cost",
        value: `${priceBreakdown.energyCost.toFixed(2)} PLN`,
      },
      {
        key: "Maintenance Cost",
        value: `${priceBreakdown.maintenanceCost.toFixed(2)} PLN`,
      },
      {
        key: "Markup",
        value: `${priceBreakdown.markupAmount.toFixed(2)} PLN (${
          priceBreakdown.markupPct
        }%)`,
      },
    ];

    if (options) {
      if (options.quality) {
        customAttributes.push({ key: "Quality", value: options.quality });
      }
      if (options.infill) {
        customAttributes.push({ key: "Infill", value: options.infill });
      }
    }

    if (customer) {
      if (customer.filamentType) {
        customAttributes.push({
          key: "Filament Type",
          value: customer.filamentType,
        });
      }
      if (customer.color) {
        customAttributes.push({ key: "Color", value: customer.color });
      }
      if (customer.amount) {
        customAttributes.push({
          key: "Amount",
          value: customer.amount.toString(),
        });
      }
      if (customer.delivery) {
        customAttributes.push({ key: "Delivery", value: customer.delivery });
      }
      if (customer.payment) {
        customAttributes.push({ key: "Payment", value: customer.payment });
      }
      if (customer.invoice) {
        customAttributes.push({
          key: "Invoice Required",
          value: customer.invoice.toString(),
        });
      }
      if (customer.terms) {
        customAttributes.push({
          key: "Terms Accepted",
          value: customer.terms.toString(),
        });
      }
    }

    const draftOrderInput: any = {
      lineItems: [
        {
          title: `3D Print - ${priceBreakdown.originalFilename}`,
          originalUnitPrice: priceBreakdown.totalPrintCost.toFixed(2),
          quantity: 1,
          customAttributes: customAttributes,
        },
      ],
    };

    if (customer) {
      draftOrderInput.email = customer.email;
      draftOrderInput.note = customer.notes;
      draftOrderInput.shippingAddress = {
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
      };
      draftOrderInput.billingAddress = {
        firstName: customer.firstName,
        lastName: customer.lastName,
      };
    }

    try {
      this.logger.debug(
        `Sending GraphQL request to: "https://${this.configService.shopifyShopName}/admin/api/${this.configService.shopifyApiVersion}/graphql.json"`
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
        }
      );

      if (response.errors) {
        this.logger.error("GraphQL errors from Shopify API:", response.errors);
        throw new Error("Failed to create Shopify draft order.");
      }

      if (response.data.draftOrderCreate.userErrors.length > 0) {
        this.logger.error(
          "Error creating Shopify draft order:",
          response.data.draftOrderCreate.userErrors
        );
        throw new Error("Failed to create Shopify draft order.");
      }

      this.logger.log(
        "Shopify draft order created:",
        response.data.draftOrderCreate.draftOrder
      );
      return response.data.draftOrderCreate.draftOrder;
    } catch (error) {
      this.logger.error(
        `Error calling Shopify API: ${error.message}`,
        error.stack
      );
      if (error.cause) {
        this.logger.error("Underlying cause of the error:", error.cause);
      }
      throw error;
    }
  }
}
