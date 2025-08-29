// src/common/dto/price-response.dto.ts
export interface PriceBreakdown {
  filament_m_used: number;
  filament_g_used: number;
  time_s: number;
  time_h: number;
  energy_kwh: number;
  costs: {
    material: number;
    energy: number;
    machine_time: number;
    labor: number;
    overhead: number;
  };
  total: number;
  currency: string;
  inputs: {
    rates: any;
    options: any;
  };
}
