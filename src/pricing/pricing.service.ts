import { Injectable } from "@nestjs/common";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import * as path from "path";
import { ConfigService } from "../config/config.service";
import { GcodeParser } from "./gcode.parser";
import { PriceBreakdown } from "./dto/price-breakdown.dto";
import { Infill, PriceRequestDto, Quality } from "./dto/price-request.dto";

@Injectable()
export class PricingService {
  constructor(private readonly config: ConfigService) {}

  async priceFromStl(
    stlPath: string,
    options: PriceRequestDto
  ): Promise<PriceBreakdown> {
    const tmpDir = this.config.tempDir;
    const gcodePath = path.join(tmpDir, `slice-${Date.now()}.gcode`);

    await this.runPrusaSlicer(stlPath, gcodePath, options);

    const gcode = await fs.readFile(gcodePath, "utf8");
    const stats = GcodeParser.parse(gcode);

    if (
      !stats.printTimeSeconds ||
      (!stats.filamentG && !stats.filamentMm && !stats.filamentCm3)
    ) {
      throw new Error("Failed to parse necessary stats from G-code");
    }

    // If only mm/cm3 are available, try estimating grams using PLA density (1.24 g/cm3) or 1.25 as typical
    const densityGPerCm3 = 1.24; // configurable if needed
    let filamentG = stats.filamentG ?? 0;
    if (!filamentG && stats.filamentCm3) {
      filamentG = stats.filamentCm3 * densityGPerCm3;
    }

    // If only mm is available, need filament cross-sectional area; use 1.75mm filament:
    // area = pi * r^2; r = 0.875 mm -> area ≈ 2.4053 mm^2
    // volume (mm^3) = length(mm) * area; convert to cm^3 by /1000; grams via density
    if (!filamentG && stats.filamentMm) {
      const r = 1.75 / 2;
      const areaMm2 = Math.PI * r * r; // ~2.4053
      const volMm3 = stats.filamentMm * areaMm2;
      const volCm3 = volMm3 / 1000.0;
      filamentG = volCm3 * densityGPerCm3;
    }

    if (!filamentG) {
      throw new Error("Unable to compute filament mass in grams");
    }

    const printTimeSeconds = stats.printTimeSeconds!;
    const printHours = printTimeSeconds / 3600;

    // Costs
    const materialCost = (filamentG / 1000.0) * this.config.filamentCostPerKg;

    const energyKwh = (this.config.printerPowerW / 1000.0) * printHours;
    const energyCost = energyKwh * this.config.energyCostPerKwh;

    const laborCost = printHours * this.config.hourlyRate;
    const maintenanceCost = printHours * this.config.maintenanceRatePerHour;

    const subtotal = materialCost + energyCost + laborCost + maintenanceCost;
    const markupAmount = subtotal * (this.config.markupPct / 100.0);
    const totalBeforeMin = subtotal + markupAmount;
    const total = Math.max(totalBeforeMin, this.config.minJobFee);

    // Cleanup
    try {
      await fs.unlink(gcodePath);
    } catch {
      // ignore
    }

    return {
      currency: process.env.CURRENCY || "PLN",
      filamentCostPerKg: this.config.filamentCostPerKg,
      energyCostPerKwh: this.config.energyCostPerKwh,
      printerPowerW: this.config.printerPowerW,
      hourlyRate: this.config.hourlyRate,
      maintenanceRatePerHour: this.config.maintenanceRatePerHour,
      markupPct: this.config.markupPct,
      minJobFee: this.config.minJobFee,

      filamentG: Number(filamentG.toFixed(2)),
      printTimeSeconds,

      materialCost: this.round2(materialCost),
      energyCost: this.round2(energyCost),
      laborCost: this.round2(laborCost),
      maintenanceCost: this.round2(maintenanceCost),
      subtotal: this.round2(subtotal),
      markupAmount: this.round2(markupAmount),
      totalBeforeMin: this.round2(totalBeforeMin),
      total: this.round2(total),
    };
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private runPrusaSlicer(
    stlPath: string,
    gcodePath: string,
    options: PriceRequestDto
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        "--load",
        ...(this.config.prusaConfigBundle
          ? [this.config.prusaConfigBundle]
          : []),
        "--layer-height",
        this.getLayerHeight(options.quality.toLowerCase() as Quality),
        "--fill-density",
        this.getFillDensity(options.infill.toLowerCase() as Infill),
        "--gcode", // output G-code
        "--output",
        gcodePath,
        stlPath,
      ].flat();

      const bin = this.config.prusaSlicerPath;
      const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });

      let stderr = "";
      child.stderr.on("data", (d) => (stderr += d.toString()));
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`PrusaSlicer failed (${code}): ${stderr}`));
      });
    });
  }

  private getLayerHeight(quality: Quality): string {
    switch (quality) {
      case Quality.STANDARD:
        return "0.3";
      case Quality.MEDIUM:
        return "0.2";
      case Quality.PREMIUM:
        return "0.1";
      default:
        return "0.2";
    }
  }

  private getFillDensity(infill: Infill): string {
    switch (infill) {
      case Infill.STANDARD:
        return "15%";
      case Infill.MEDIUM:
        return "30%";
      case Infill.PREMIUM:
        return "50%";
      default:
        return "30%";
    }
  }
}
