import { PriceRequestDto } from "./../../pricing/dto/price-request.dto";

export class CreateOrderDto {
  filename: string;
  options: PriceRequestDto;
}
