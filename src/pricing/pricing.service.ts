// src/pricing/pricing.service.ts
import { Injectable } from "@nestjs/common";
import { parseGcodeHeader } from "./gcode.parser";

export type Rates = {
  currency: string;
  material_cost_per_kg: number; // e.g., 20
  density_g_per_m: number; // filament grams per meter for the chosen diameter/material (approx)
  energy_cost_per_kwh: number; // e.g., 0.25
  printer_power_w: number; // average power draw
  machine_cost_per_hour: number; // depreciation/usage
  labor_cost_per_job: number; // handling
  overhead_pct: number; // percentage on subtotal
};

@Injectable()
export class PricingService {
  compute(
    gcodePath: string,
    rates: Rates,
    fallback: { filament_m?: number; time_s?: number },
  ) {
    const parsed = parseGcodeHeader(gcodePath);
    const filament_m = parsed.filament_m ?? fallback.filament_m ?? 0;
    const time_s = parsed.time_s ?? fallback.time_s ?? 0;

    const filament_g = filament_m * rates.density_g_per_m;
    const filament_kg = filament_g / 1000;

    const time_h = time_s / 3600;
    const energy_kwh = (rates.printer_power_w * time_h) / 1000;

    const material = filament_kg * rates.material_cost_per_kg;
    const energy = energy_kwh * rates.energy_cost_per_kwh;
    const machine_time = time_h * rates.machine_cost_per_hour;
    const labor = rates.labor_cost_per_job;

    const sub = material + energy + machine_time + labor;
    const overhead = (rates.overhead_pct / 100) * sub;
    const total = sub + overhead;

    return {
      filament_m_used: filament_m,
      filament_g_used: filament_g,
      time_s,
      time_h,
      energy_kwh,
      costs: { material, energy, machine_time, labor, overhead },
      total,
      currency: rates.currency,
      inputs: { rates, options: parsed },
    };
  }
}
