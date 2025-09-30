import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PricingModule } from "./pricing/pricing.module";
import { ConfigModule } from "./config/config.module";
import { ScheduleModule } from "@nestjs/schedule";
import { CleanupModule } from "./cleanup/cleanup.module";
import { ShopifyModule } from "./shopify/shopify.module";
import { EventsModule } from "./events/events.module";

@Module({
  imports: [
    ConfigModule,
    PricingModule,
    ScheduleModule.forRoot(),
    CleanupModule,
    ShopifyModule,
    EventsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
