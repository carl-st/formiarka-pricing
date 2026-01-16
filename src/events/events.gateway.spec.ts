import { Test, TestingModule } from "@nestjs/testing";
import { EventsGateway } from "./events.gateway";
import { DraftOrderStatusDto } from "../shopify/dto/draft-order-status.dto";

describe("EventsGateway", () => {
  let gateway: EventsGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventsGateway],
    }).compile();

    gateway = module.get<EventsGateway>(EventsGateway);
  });

  it("should be defined", () => {
    expect(gateway).toBeDefined();
  });

  describe("handleSubscribeToOrder", () => {
    it("should subscribe a client to an order", () => {
      const client = { id: "test-client" } as any;
      const draftOrderId = "12345";

      gateway.handleSubscribeToOrder(client, draftOrderId);

      expect(gateway["clients"].get(draftOrderId)).toBe(client);
    });
  });

  describe("handleUnsubscribeFromOrder", () => {
    it("should unsubscribe a client from an order", () => {
      const client = { id: "test-client" } as any;
      const draftOrderId = "12345";

      gateway["clients"].set(draftOrderId, client);
      gateway.handleUnsubscribeFromOrder(client, draftOrderId);

      expect(gateway["clients"].has(draftOrderId)).toBe(false);
    });
  });

  describe("emitOrderStatusUpdate", () => {
    it("should emit an order status update to a subscribed client", () => {
      const client = {
        id: "test-client",
        emit: jest.fn(),
      } as any;
      const draftOrderId = "12345";
      const status: DraftOrderStatusDto = {
        draftOrderId: "gid://shopify/DraftOrder/12345",
        orderId: "gid://shopify/Order/67890",
        status: "completed",
      };

      gateway["clients"].set(draftOrderId, client);
      gateway.emitOrderStatusUpdate(draftOrderId, status);

      expect(client.emit).toHaveBeenCalledWith("orderStatusUpdate", status);
    });
  });
});
