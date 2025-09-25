import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "../config/config.service";
import { PriceBreakdown } from "./../pricing/dto/price-breakdown.dto";
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
    filename: string,
    stlPath: string
  ): Promise<any> {
    this.logger.log(`Creating Shopify draft order for ${filename}`);

    // Note on file uploads: Shopify's GraphQL API for Draft Orders doesn't directly
    // support file attachments on line items. A common pattern is to upload the
    // file to Shopify's file storage first (using the `fileCreate` mutation)
    // and then reference the returned file GID in a custom attribute on the line item.
    // For simplicity, we'll just add the filename as a property for now.

    const draftOrderInput = {
      lineItems: [
        {
          title: `3D Print - ${filename}`,
          originalUnitPrice: priceBreakdown.totalPrintCost.toFixed(2),
          quantity: 1,
          customAttributes: [
            {
              key: "Material",
              value: `${priceBreakdown.filamentG.toFixed(2)}g`,
            },
            {
              key: "Print Time",
              value: `${(priceBreakdown.printTimeSeconds / 3600).toFixed(
                2
              )} hours`,
            },
            {
              key: "STL Filename",
              value: filename,
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
              key: "Labor Cost",
              value: `${priceBreakdown.laborCost.toFixed(2)} PLN`,
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
          ],
        },
      ],
    };

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
