import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "../config/config.service";
import * as fs from "fs/promises";
import * as path from "path";

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);
  private readonly TMP_FILE_TTL_HOURS = 24; // Time-to-live for temp files in hours

  constructor(private readonly config: ConfigService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // Runs once a day
  async handleCron() {
    this.logger.log("Running scheduled cleanup of temporary files...");
    const tmpDir = this.config.tempDir;

    try {
      const files = await fs.readdir(tmpDir);
      const now = Date.now();

      for (const file of files) {
        // We only care about our upload and slice files
        if (!file.startsWith("upload-") && !file.startsWith("slice-")) {
          continue;
        }

        const filePath = path.join(tmpDir, file);
        try {
          const stats = await fs.stat(filePath);
          const fileAgeHours = (now - stats.mtime.getTime()) / (1000 * 60 * 60);

          if (fileAgeHours > this.TMP_FILE_TTL_HOURS) {
            await fs.unlink(filePath);
            this.logger.log(`Deleted old temporary file: ${filePath}`);
          }
        } catch (err) {
          this.logger.error(
            `Failed to process file ${filePath}: ${err.message}`,
          );
        }
      }
    } catch (err) {
      if (err.code === "ENOENT") {
        this.logger.log(
          `Temporary directory ${tmpDir} not found, skipping cleanup.`,
        );
      } else {
        this.logger.error(
          `Failed to read temporary directory ${tmpDir}: ${err.message}`,
        );
      }
    }
  }
}
