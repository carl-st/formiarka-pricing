export interface GcodeStats {
  filamentMm?: number; // total filament length in mm
  filamentCm3?: number; // filament volume in cm^3
  filamentG?: number; // filament mass in grams
  printTimeSeconds?: number; // total estimated time in seconds
}

export interface PriceBreakdown {
  currency: string;

  // Inputs
  filamentCostPerKg: number;
  energyCostPerKwh: number;
  printerPowerW: number;
  hourlyRate: number;
  maintenanceRatePerHour: number;
  markupPct: number;
  minJobFee: number;

  // Parsed from G-code
  filamentG: number;
  printTimeSeconds: number;

  // Derived costs
  materialCost: number;
  energyCost: number;
  laborCost: number;
  maintenanceCost: number;
  subtotal: number;
  markupAmount: number;
  totalBeforeMin: number;
  total: number;
}
