// src/app.module.ts
import { Module } from "@nestjs/common";
import { PricingModule } from "./pricing/pricing.module";

@Module({
  imports: [PricingModule],
})
export class AppModule {}
