import { Module } from "@nestjs/common";
import { CleanupService } from "./cleanup.service";
import { ConfigModule } from "../config/config.module";

@Module({
  imports: [ConfigModule],
  providers: [CleanupService],
})
export class CleanupModule {}
