// src/pricing/cura.service.ts
import { Injectable } from "@nestjs/common";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";

export type CuraSliceOptions = {
  layerHeight?: number; // mm
  infillPct?: number; // %
  printSpeed?: number; // mm/s
  filamentDiameter?: number; // mm
  nozzleDiameter?: number; // mm
};

@Injectable()
export class CuraService {
  async slice(
    stlPath: string,
    outDir: string,
    opts: CuraSliceOptions = {},
  ): Promise<string> {
    const outGcode = path.join(
      outDir,
      path.basename(stlPath, path.extname(stlPath)) + ".gcode",
    );

    const args: string[] = ["slice"];
    // CuraEngine v14+ syntax pattern: -s key=value, -o output.gcode, input.stl
    // Convert to Cura units where needed
    if (opts.layerHeight) {
      // CuraEngine layerThickness expects micrometers in legacy versions; modern forks often accept mm. Use mm -> micrometers.
      args.push("-s", `layerThickness=${Math.round(opts.layerHeight * 1000)}`);
    }
    if (opts.infillPct !== undefined) {
      // sparseInfillLineDistance is derived; for simplicity, rely on infillPercentage if supported, else omit.
      args.push("-s", `infillPercentage=${Math.round(opts.infillPct)}`);
    }
    if (opts.printSpeed) {
      args.push("-s", `printSpeed=${opts.printSpeed}`); // mm/s
    }
    if (opts.filamentDiameter) {
      args.push("-s", `filamentDiameter=${opts.filamentDiameter}`);
    }
    if (opts.nozzleDiameter) {
      args.push("-s", `extrusionWidth=${opts.nozzleDiameter}`); // approximation
    }

    args.push("-o", outGcode);

    args.push("-l", stlPath);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("CuraEngine", args, {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stderr = "";
      proc.stderr.on("data", (d) => (stderr += d.toString()));
      proc.on("close", (code) => {
        if (code === 0 && fs.existsSync(outGcode)) resolve();
        else reject(new Error(`CuraEngine failed (${code}): ${stderr}`));
      });
    });

    return outGcode;
  }
}
