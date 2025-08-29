// src/pricing/pricing.module.ts
import { Module } from "@nestjs/common";
import { PricingController } from "./pricing.controller";
import { PricingService } from "./pricing.service";
import { CuraService } from "./cura.service";

@Module({
  controllers: [PricingController],
  providers: [PricingService, CuraService],
})
export class PricingModule {}
