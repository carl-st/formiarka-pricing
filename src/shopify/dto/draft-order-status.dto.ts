import { ApiProperty } from "@nestjs/swagger";

export class DraftOrderStatusDto {
  @ApiProperty({
    description: "The GID of the draft order.",
    example: "gid://shopify/DraftOrder/1234567890",
  })
  draftOrderId: string;

  @ApiProperty({
    description: "The GID of the order, if the draft order is completed.",
    example: "gid://shopify/Order/1234567890",
    required: false,
  })
  orderId?: string;

  @ApiProperty({
    description: "The status of the draft order.",
    example: "completed",
  })
  status: string;
}
