import * as dotenv from "dotenv";

dotenv.config();

export class ConfigService {
  get port(): number {
    return parseInt(process.env.PORT || "3000", 10);
  }

  get prusaSlicerPath(): string {
    // In container we’ll add PrusaSlicer to PATH; allow override
    return process.env.PRUSASLICER_PATH || "prusa-slicer";
  }

  // Costs and rates
  get filamentCostPerKg(): number {
    return parseFloat(process.env.FILAMENT_COST_PER_KG || "90"); // PLN/kg example
  }

  get energyCostPerKwh(): number {
    return parseFloat(process.env.ENERGY_COST_PER_KWH || "1.2"); // PLN/kWh example
  }

  get printerPowerW(): number {
    return parseFloat(process.env.PRINTER_POWER_W || "120"); // watts
  }

  get hourlyRate(): number {
    return parseFloat(process.env.HOURLY_RATE || "20"); // PLN/hour
  }

  get maintenanceRatePerHour(): number {
    return parseFloat(process.env.MAINTENANCE_RATE_PER_HOUR || "5"); // PLN/hour
  }

  get markupPct(): number {
    return parseFloat(process.env.MARKUP_PCT || "10"); // %
  }

  get minJobFee(): number {
    return parseFloat(process.env.MIN_JOB_FEE || "15"); // PLN
  }

  // Slicing profile / printer profile paths (optional)
  get prusaConfigBundle(): string | undefined {
    return process.env.PRUSA_CONFIG_BUNDLE; // e.g., /configs/bundle.ini
  }

  get tempDir(): string {
    return process.env.TMP_DIR || "/tmp";
  }
}
