import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrintModule } from "./print-price/print-price.module";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrintModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
