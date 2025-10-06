import {
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";

@WebSocketGateway({
  cors: {
    origin: "*", // Allow all origins for now, should be restricted in production
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private clients: Map<string, Socket> = new Map();

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Clean up the clients map
    for (const [key, value] of this.clients.entries()) {
      if (value === client) {
        this.clients.delete(key);
        break;
      }
    }
  }

  @SubscribeMessage("subscribeToOrder")
  handleSubscribeToOrder(client: Socket, draftOrderId: string): void {
    this.logger.log(`Client ${client.id} subscribing to order ${draftOrderId}`);
    this.clients.set(draftOrderId, client);
  }

  emitOrderStatusUpdate(draftOrderId: string, status: any) {
    const client = this.clients.get(draftOrderId);
    if (client) {
      this.logger.log(
        `Emitting order status update for ${draftOrderId} to client ${client.id}`,
      );
      client.emit("orderStatusUpdate", status);
    } else {
      this.logger.warn(`No client subscribed to order ${draftOrderId}`);
    }
  }
}
