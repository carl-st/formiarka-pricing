export class GcodeParser {
  static parse(gcode: string): {
    filamentG?: number;
    filamentMm?: number;
    filamentCm3?: number;
    printTimeSeconds?: number;
  } {
    const result: any = {};

    // Common PrusaSlicer comment patterns:
    // ; filament used [mm] = 12345.67
    const mmMatch = gcode.match(
      /;\s*filament used\s*(?:\[mm])?\s*=\s*([\d.]+)/i,
    );
    if (mmMatch) {
      result.filamentMm = parseFloat(mmMatch[1]);
    }

    // ; total filament used [g] = 123.45
    const gMatch = gcode.match(
      /;\s*total filament used\s*\[g]\s*=\s*([\d.]+)/i,
    );
    if (gMatch) {
      result.filamentG = parseFloat(gMatch[1]);
    }

    // ; filament used = 12345.67 mm (78.90 cm3)
    const cm3Match = gcode.match(
      /;\s*filament used\s*=\s*[\d.]+\s*mm\s*\(([\d.]+)\s*cm3\)/i,
    );
    if (cm3Match) {
      result.filamentCm3 = parseFloat(cm3Match[1]);
    }

    // ; estimated printing time (normal mode) = 3h 12m 10s
    const timeLine = gcode.match(
      /;\s*estimated printing time.*?=\s*([^\n\r]+)/i,
    );
    if (timeLine) {
      result.printTimeSeconds = this.parseTimeToSeconds(timeLine[1]);
    }

    // Some slicers provide: ; TIME:12345 (seconds)
    const timeSecondsMatch = gcode.match(/;\s*TIME\s*:\s*(\d+)/i);
    if (!result.printTimeSeconds && timeSecondsMatch) {
      result.printTimeSeconds = parseInt(timeSecondsMatch[1], 10);
    }

    return result;
  }

  private static parseTimeToSeconds(text: string): number {
    // Supports formats like "1d 2h 3m 4s", "3h 12m", "45m", "123s"
    let seconds = 0;
    const d = text.match(/(\d+)\s*d/i);
    const h = text.match(/(\d+)\s*h/i);
    const m = text.match(/(\d+)\s*m/i);
    const s = text.match(/(\d+)\s*s/i);
    if (d) seconds += parseInt(d[1], 10) * 86400;
    if (h) seconds += parseInt(h[1], 10) * 3600;
    if (m) seconds += parseInt(m[1], 10) * 60;
    if (s) seconds += parseInt(s[1], 10);
    return seconds;
  }
}
