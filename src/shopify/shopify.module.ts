import { Module } from "@nestjs/common";
import { ShopifyController } from "./shopify.controller";
import { ShopifyService } from "./shopify.service";
import { PricingModule } from "../pricing/pricing.module";
import { ConfigModule } from "../config/config.module";
import { EventsModule } from "../events/events.module";

@Module({
  imports: [PricingModule, ConfigModule, EventsModule],
  controllers: [ShopifyController],
  providers: [ShopifyService],
})
export class ShopifyModule {}
