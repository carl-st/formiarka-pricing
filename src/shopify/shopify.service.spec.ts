import { Test, TestingModule } from "@nestjs/testing";
import { ShopifyService } from "./shopify.service";
import { ConfigService } from "../config/config.service";
import { PriceBreakdown, Customer } from "../pricing/dto/price-breakdown.dto";
import {
  Infill,
  PriceRequestDto,
  Quality,
} from "../pricing/dto/price-request.dto";
import { createAdminApiClient } from "@shopify/admin-api-client";

jest.mock("@shopify/admin-api-client", () => ({
  createAdminApiClient: jest.fn(),
}));

describe("ShopifyService", () => {
  let service: ShopifyService;
  let configService: ConfigService;

  let mockClient: any;

  beforeEach(async () => {
    mockClient = {
      request: jest.fn().mockResolvedValue({
        data: {
          draftOrderCreate: {
            draftOrder: {
              id: "gid://shopify/DraftOrder/123456789",
              invoiceUrl: "https://test-shop.myshopify.com/invoice/123456789",
            },
            userErrors: [],
          },
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopifyService,
        {
          provide: ConfigService,
          useValue: {
            shopifyShopName: "test-shop.myshopify.com",
            shopifyAdminApiToken: "shpat_test_token",
            shopifySharedSecret: "test_secret",
            shopifyApiVersion: "2025-07",
          },
        },
      ],
    }).compile();

    service = module.get<ShopifyService>(ShopifyService);
    configService = module.get<ConfigService>(ConfigService);
    (service as any).client = mockClient;
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createOrder", () => {
    it("should create a draft order with correct attributes", async () => {
      // Reset and configure the mockClient that's actually used by the service
      mockClient.request.mockResolvedValue({
        data: {
          draftOrderCreate: {
            draftOrder: {
              id: "gid://shopify/DraftOrder/123456789",
              invoiceUrl: "https://test-shop.myshopify.com/invoice/123456789",
            },
            userErrors: [],
          },
        },
      });

      const priceBreakdown: PriceBreakdown = {
        originalFilename: "test.stl",
        filamentG: 100,
        printTimeSeconds: 3600,
        materialCost: 50,
        energyCost: 20,
        maintenanceCost: 10,
        markupAmount: 20,
        markupPct: 20,
        totalPrintCost: 100,
      };

      const customer: Partial<Customer> = {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        filamentType: "PLA",
        color: "Red",
        amount: 1,
        delivery: "InPost Paczkomat",
        payment: "Credit Card",
        invoice: true,
        terms: true,
        lockerData: {
          name: "Locker 1",
          type: "parcel_locker",
          location: {
            latitude: 50.0646501,
            longitude: 19.9449799,
          },
          address: {
            line1: "Address Line 1",
            line2: "Address Line 2",
            city: "City",
            postCode: "12345",
            countryCode: "PL",
          },
        },
      };

      const options: PriceRequestDto = {
        quality: Quality.MEDIUM,
        infill: Infill.MEDIUM,
        originalFilename: "test.stl",
      };

      const result = await service.createOrder(
        "https://example.com/test.stl",
        priceBreakdown,
        customer,
        options,
      );

      expect(mockClient.request).toHaveBeenCalled();
      expect(result.id).toBe("gid://shopify/DraftOrder/123456789");
    });

    it("should throw an error if customer is not provided", async () => {
      const priceBreakdown: PriceBreakdown = {
        originalFilename: "test.stl",
        filamentG: 100,
        printTimeSeconds: 3600,
        materialCost: 50,
        energyCost: 20,
        maintenanceCost: 10,
        markupAmount: 20,
        markupPct: 20,
        totalPrintCost: 100,
        currency: "PLN",
        filamentCostPerKg: 100,
        energyCostPerKwh: 0.1,
        maintenanceRatePerHour: 10,
        printerPowerW: 200,
        hourlyRate: 10,
        minJobFee: 5,
        laborCost: 10,
        subtotal: 90,
        totalBeforeMin: 95,
      };
      const options: PriceRequestDto = {
        quality: Quality.MEDIUM,
        infill: Infill.MEDIUM,
        originalFilename: "test.stl",
      };

      await expect(
        service.createOrder(
          "https://example.com/test.stl",
          priceBreakdown,
          // @ts-ignore
          undefined,
          options,
        ),
      ).rejects.toThrow("Customer data is required");
    });
  });

  describe("verifyWebhook", () => {
    it("should return false for invalid HMAC", async () => {
      const result = await service.verifyWebhook("invalid_hmac", {
        test: "data",
      });
      expect(result).toBe(false);
    });
  });

  describe("getDraftOrderStatus", () => {
    it("should return draft order status", async () => {
      mockClient.request.mockResolvedValueOnce({
        data: {
          draftOrder: {
            id: "gid://shopify/DraftOrder/123456789",
            status: "open",
          },
        },
      });

      const result = await service.getDraftOrderStatus(
        "gid://shopify/DraftOrder/123456789",
      );
      expect(result.id).toBe("gid://shopify/DraftOrder/123456789");
      expect(result.status).toBe("open");
    });

    it("should throw an error if draft order status fetch fails", async () => {
      mockClient.request.mockResolvedValueOnce({
        errors: [{ message: "Draft order not found" }],
      });

      await expect(
        service.getDraftOrderStatus("gid://shopify/DraftOrder/123456789"),
      ).rejects.toThrow("Failed to fetch draft order status");
    });
  });
});
