// src/pricing/gcode-parser.ts
import * as fs from "fs";

export type ParsedGcode = {
  time_s?: number;
  filament_m?: number;
  layer_height_mm?: number;
};

export function parseGcodeHeader(path: string): ParsedGcode {
  const fd = fs.openSync(path, "r");
  try {
    const buf = Buffer.alloc(64 * 1024);
    const bytes = fs.readSync(fd, buf, 0, buf.length, 0);
    const head = buf.slice(0, bytes).toString("utf8");
    const p: ParsedGcode = {};
    // ;TIME:2582
    const tMatch = head.match(/;TIME:(\d+)/);
    if (tMatch) p.time_s = parseInt(tMatch[1], 10);
    // ;Filament used: 1.57225m
    const fMatch = head.match(/;Filament used:\s*([\d.]+)\s*m/i);
    if (fMatch) p.filament_m = parseFloat(fMatch[1]);
    // ;Layer height: 0.2
    const lhMatch = head.match(/;Layer height:\s*([\d.]+)/i);
    if (lhMatch) p.layer_height_mm = parseFloat(lhMatch[1]);
    return p;
  } finally {
    fs.closeSync(fd);
  }
}
