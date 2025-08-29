// src/common/dto/slice-options.dto.ts
export class SliceOptionsDto {
  // optionally override defaults
  layerHeight?: number; // mm
  infillPct?: number; // %
  printSpeed?: number; // mm/s
  filamentDiameter?: number; // mm
  nozzleDiameter?: number; // mm
  material?: string; // e.g., "PLA"
  // add more CuraEngine-exposed settings as needed
}
