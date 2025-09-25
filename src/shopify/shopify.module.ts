import { Module } from "@nestjs/common";
import { ShopifyController } from "./shopify.controller";
import { ShopifyService } from "./shopify.service";
import { PricingModule } from "../pricing/pricing.module";
import { ConfigModule } from "../config/config.module";

@Module({
  imports: [PricingModule, ConfigModule],
  controllers: [ShopifyController],
  providers: [ShopifyService],
})
export class ShopifyModule {}
