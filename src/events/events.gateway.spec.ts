import { Test, TestingModule } from "@nestjs/testing";
import { EventsGateway } from "./events.gateway";
import { DraftOrderStatusDto } from "../shopify/dto/draft-order-status.dto";
import { Server, Socket } from "socket.io";

// Mock @nestjs/websockets decorators to avoid issues
jest.mock("@nestjs/websockets", () => ({
  SubscribeMessage: () => () => {}, // No-op decorator
  WebSocketGateway: () => () => {}, // No-op decorator
  OnGatewayConnection: () => () => {}, // No-op decorator
  OnGatewayDisconnect: () => () => {}, // No-op decorator
  WebSocketServer: () => () => {}, // No-op decorator
}));

describe("EventsGateway", () => {
  let gateway: EventsGateway;
  let mockServer: Partial<Server>;
  let mockSocket: Partial<Socket>;

  beforeEach(async () => {
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      sockets: {
        adapter: {
          rooms: {
            get: jest.fn(),
          },
        },
      },
    };

    mockSocket = {
      id: "test-client",
      join: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [EventsGateway],
    }).compile();

    gateway = module.get<EventsGateway>(EventsGateway);
    // Mock the server property
    Object.defineProperty(gateway, "server", {
      value: mockServer as Server,
      writable: true,
    });
  });

  it("should be defined", () => {
    expect(gateway).toBeDefined();
  });

  describe("handleSubscribeToOrder", () => {
    it("should subscribe a client to an order", () => {
      const client = mockSocket as Socket;
      const draftOrderId = "12345";

      gateway.handleSubscribeToOrder(client, draftOrderId);

      expect(client.join).toHaveBeenCalledWith(draftOrderId);
    });
  });

  describe("emitOrderStatusUpdate", () => {
    it("should emit an order status update to subscribed clients", () => {
      const draftOrderId = "12345";
      const status: DraftOrderStatusDto = {
        draftOrderId: "gid://shopify/DraftOrder/12345",
        orderId: "gid://shopify/Order/67890",
        status: "completed",
      };

      // Mock the room to exist with clients
      const mockRoom = {
        size: 1,
      };
      (mockServer.sockets.adapter.rooms.get as jest.Mock).mockReturnValue(
        mockRoom,
      );

      gateway.emitOrderStatusUpdate(draftOrderId, status);

      expect(mockServer.to).toHaveBeenCalledWith(draftOrderId);
      expect(mockServer.emit).toHaveBeenCalledWith("orderStatusUpdate", status);
    });

    it("should log a warning if no clients are subscribed", () => {
      const draftOrderId = "12345";
      const status: DraftOrderStatusDto = {
        draftOrderId: "gid://shopify/DraftOrder/12345",
        orderId: "gid://shopify/Order/67890",
        status: "completed",
      };

      // Mock the room to not exist or be empty
      (mockServer.sockets.adapter.rooms.get as jest.Mock).mockReturnValue(
        undefined,
      );

      gateway.emitOrderStatusUpdate(draftOrderId, status);

      expect(mockServer.to).not.toHaveBeenCalled();
      expect(mockServer.emit).not.toHaveBeenCalled();
    });
  });
});
