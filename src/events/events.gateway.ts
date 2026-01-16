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

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("subscribeToOrder")
  handleSubscribeToOrder(client: Socket, draftOrderId: string): void {
    this.logger.log(`Client ${client.id} subscribing to order ${draftOrderId}`);
    client.join(draftOrderId);
  }

  emitOrderStatusUpdate(draftOrderId: string, status: any) {
    const orderId = draftOrderId.toString();
    const room = this.server.sockets.adapter.rooms.get(orderId);
    this.logger.log(`Emitting to room: ${orderId}`);
    if (room && room.size > 0) {
      this.logger.log(
        `Emitting order status update for ${orderId} to ${room.size} client(s).`,
      );
      this.server.to(orderId).emit("orderStatusUpdate", status);
    } else {
      this.logger.warn(`No client subscribed to order ${orderId}`);
    }
  }
}
