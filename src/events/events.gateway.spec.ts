import { Test, TestingModule } from "@nestjs/testing";
import { EventsGateway } from "./events.gateway";
import { DraftOrderStatusDto } from "../shopify/dto/draft-order-status.dto";
import { Server, Socket } from "socket.io";

describe("EventsGateway", () => {
  let gateway: EventsGateway;
  let mockServer: Partial<Server>;
  let mockSocket: Partial<Socket>;

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
    } as any;

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

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(client.join as jest.Mock).toHaveBeenCalledWith(draftOrderId);
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      (mockServer as any).sockets.adapter.rooms.get.mockReturnValue(mockRoom);

      gateway.emitOrderStatusUpdate(draftOrderId, status);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((mockServer as any).to).toHaveBeenCalledWith(draftOrderId);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((mockServer as any).emit).toHaveBeenCalledWith(
        "orderStatusUpdate",
        status,
      );
    });

    it("should log a warning if no clients are subscribed", () => {
      const draftOrderId = "12345";
      const status: DraftOrderStatusDto = {
        draftOrderId: "gid://shopify/DraftOrder/12345",
        orderId: "gid://shopify/Order/67890",
        status: "completed",
      };

      // Mock the room to not exist or be empty
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      (mockServer as any).sockets.adapter.rooms.get.mockReturnValue(undefined);

      gateway.emitOrderStatusUpdate(draftOrderId, status);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((mockServer as any).to).not.toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((mockServer as any).emit).not.toHaveBeenCalled();
    });
  });
});
