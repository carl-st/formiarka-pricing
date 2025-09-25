import { Module } from "@nestjs/common";
import { PricingController } from "./pricing.controller";
import { PricingService } from "./pricing.service";
import { ConfigModule } from "../config/config.module";

@Module({
  imports: [ConfigModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
