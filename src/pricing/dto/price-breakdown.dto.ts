export interface GcodeStats {
  filamentMm?: number; // total filament length in mm
  filamentCm3?: number; // filament volume in cm^3
  filamentG?: number; // filament mass in grams
  printTimeSeconds?: number; // total estimated time in seconds
}

export interface PriceBreakdown {
  originalFilename?: string;
  tempFilename?: string;
  uploadedFileUrl?: string;
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
  totalPrintCost: number;
}

export interface Customer {
  quality: string;
  filamentType: string;
  infill: string;
  color: string;
  amount: number;
  delivery: string;
  notes: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  zip?: string;
  countryCode?: string;
  invoice: boolean;
  payment: string;
  terms: boolean;
  dimensions: { width: number; height: number; depth: number };
  shippingCost: number;
  totalCost: number;
  uploadedFileUrl: string;
  error: string | null;
}

export type Order = Customer & PriceBreakdown;
