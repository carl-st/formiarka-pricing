import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as crypto from "crypto";
import { ConfigService } from "../config/config.service";
import { PriceBreakdown, Customer } from "./../pricing/dto/price-breakdown.dto";
import { PriceRequestDto } from "./../pricing/dto/price-request.dto";
import { createAdminApiClient } from "@shopify/admin-api-client";
import type { AdminApiClient } from "@shopify/admin-api-client";
import { ApiVersion } from "@shopify/shopify-api";

@Injectable()
export class ShopifyService implements OnModuleInit {
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

    addAttribute("Material", `${priceBreakdown.filamentG.toFixed(2)}g`);
    addAttribute(
      "Print Time",
      `${(priceBreakdown.printTimeSeconds / 3600).toFixed(2)} hours`,
    );
    addAttribute("Original STL Filename", priceBreakdown.originalFilename);
    addAttribute("Temporary STL Filename", priceBreakdown.tempFilename);
    addAttribute(
      "Material Cost",
      `${priceBreakdown.materialCost.toFixed(2)} PLN`,
    );
    addAttribute("Energy Cost", `${priceBreakdown.energyCost.toFixed(2)} PLN`);
    addAttribute(
      "Maintenance Cost",
      `${priceBreakdown.maintenanceCost.toFixed(2)} PLN`,
    );
    addAttribute(
      "Markup",
      `${priceBreakdown.markupAmount.toFixed(2)} PLN (${priceBreakdown.markupPct}%)`,
    );

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
          title: `3D Print - ${priceBreakdown.originalFilename}`,
          originalUnitPrice: priceBreakdown.totalPrintCost.toFixed(2),
          quantity: 1,
          customAttributes: customAttributes,
        },
      ],
      shippingLine: {
        title: "InPost Paczkomat",
        price: "16.99",
        code: "INPOST_STANDARD",
      },
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

  async getOrderStatus(draftOrderId: string): Promise<any> {
    this.logger.log(`Getting status for Shopify draft order ${draftOrderId}`);

    try {
      const response = await this.client.request(
        `query getDraftOrder($id: ID!) {
          draftOrder(id: $id) {
            id
            status
            order {
              id
              displayFinancialStatus
            }
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
        throw new Error("Failed to get Shopify draft order status.");
      }

      if (!response.data.draftOrder) {
        this.logger.error(`Draft order with ID ${draftOrderId} not found.`);
        throw new Error("Draft order not found.");
      }

      const { draftOrder } = response.data;

      this.logger.debug(
        `Draft order status for ${draftOrderId}: ${draftOrder.status}`,
      );

      if (draftOrder.order) {
        this.logger.log(
          `Draft order ${draftOrderId} is associated with order ${draftOrder.order.id}. Financial status: ${draftOrder.order.displayFinancialStatus}`,
        );
        return {
          status: "COMPLETED",
          financialStatus: draftOrder.order.displayFinancialStatus,
          orderId: draftOrder.order.id,
        };
      } else {
        this.logger.log(
          `Draft order ${draftOrderId} is not yet associated with an order. Status: ${draftOrder.status}`,
        );
        return {
          status: draftOrder.status, // e.g., 'OPEN', 'INVOICE_SENT'
          financialStatus: null,
        };
      }
    } catch (error) {
      this.logger.error(
        `Error calling Shopify API for draft order status: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async onModuleInit() {
    await this.registerWebhook();
  }

  async registerWebhook() {
    const webhookUrl = `${process.env.HOST}/shopify/webhook`;
    this.logger.log(
      `Registering webhook for topic orders/paid at ${webhookUrl}`,
    );

    const query = `
      mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
          webhookSubscription {
            id
            endpoint {
              __typename
              ... on WebhookHttpEndpoint {
                callbackUrl
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }`;

    const variables = {
      topic: "ORDERS_PAID",
      webhookSubscription: {
        callbackUrl: webhookUrl,
        format: "JSON",
      },
    };

    try {
      // First, check if the webhook already exists
      const existingWebhooksResponse = await this.client.request(
        `query webhookSubscriptions($first: Int!) {
          webhookSubscriptions(first: $first) {
            edges {
              node {
                id
                topic
                endpoint {
                  __typename
                  ... on WebhookHttpEndpoint {
                    callbackUrl
                  }
                }
              }
            }
          }
        }`,
        { variables: { first: 10 } },
      );

      const existingWebhook =
        existingWebhooksResponse.data.webhookSubscriptions.edges.find(
          (edge: any) =>
            edge.node.topic === "ORDERS_PAID" &&
            edge.node.endpoint.callbackUrl === webhookUrl,
        );

      if (existingWebhook) {
        this.logger.log("Webhook already registered.");
        return;
      }

      const response = await this.client.request(query, { variables });
      if (response.data.webhookSubscriptionCreate.userErrors.length > 0) {
        this.logger.error(
          "Error registering webhook:",
          response.data.webhookSubscriptionCreate.userErrors,
        );
      } else {
        this.logger.log("Webhook registered successfully.");
      }
    } catch (error) {
      this.logger.error("Error registering webhook:", error);
    }
  }

  verifyWebhook(hmac: string, rawBody: Buffer): boolean {
    if (!hmac || !rawBody) {
      return false;
    }

    const generatedHmac = crypto
      .createHmac("sha256", this.configService.shopifySharedSecret)
      .update(rawBody)
      .digest("base64");

    return hmac === generatedHmac;
  }
}
