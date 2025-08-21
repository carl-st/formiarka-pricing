import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class PrintService {
  async calculatePrice(
    file: Express.Multer.File,
    filamentCostPerGram: number,
    printerCostPerHour: number,
    infill?: number,
  ): Promise<any> {
    const stlPath = file.path;
    const gcodePath = path.join(
      "gcodes",
      `${path.basename(stlPath, ".stl")}.gcode`,
    );
    const infillPercentage = infill || 20; // Default infill

    try {
      await this.sliceStlToGcode(stlPath, gcodePath, infillPercentage);
      const gcode = fs.readFileSync(gcodePath, "utf-8");
      const { filamentUsedGrams, printTimeHours } = this.parseGcode(gcode);

      const materialCost = filamentUsedGrams * filamentCostPerGram;
      const machineCost = printTimeHours * printerCostPerHour;
      const totalCost = materialCost + machineCost;

      // Clean up generated files
      fs.unlinkSync(stlPath);
      fs.unlinkSync(gcodePath);

      return {
        filename: file.originalname,
        materialCost: parseFloat(materialCost.toFixed(2)),
        machineCost: parseFloat(machineCost.toFixed(2)),
        totalCost: parseFloat(totalCost.toFixed(2)),
        printTimeHours: parseFloat(printTimeHours.toFixed(2)),
        filamentUsedGrams: parseFloat(filamentUsedGrams.toFixed(2)),
      };
    } catch (error) {
      // Clean up in case of error
      if (fs.existsSync(stlPath)) fs.unlinkSync(stlPath);
      if (fs.existsSync(gcodePath)) fs.unlinkSync(gcodePath);
      throw new InternalServerErrorException(
        `Failed to process file: ${error.message}`,
      );
    }
  }

  private sliceStlToGcode(
    stlPath: string,
    gcodePath: string,
    infill: number,
  ): Promise<void> {
    // Note: You must have OrcaSlicer installed and accessible from the command line.
    // The command might need adjustment based on your OrcaSlicer installation and printer profile.
    const command = `orca-slicer "${stlPath}" --outputdir "gcodes" --slice 0 --export-gcode`;

    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Slicing error: ${stderr}`);
          return reject(new Error(`OrcaSlicer failed: ${stderr}`));
        }
        resolve();
      });
    });
  }

  private parseGcode(gcode: string): {
    filamentUsedGrams: number;
    printTimeHours: number;
  } {
    let filamentLengthMm = 0;
    let printTimeSeconds = 0;

    const filamentMatch = gcode.match(/; filament used \[mm] = (.*)/);
    if (filamentMatch && filamentMatch[1]) {
      filamentLengthMm = parseFloat(filamentMatch[1]);
    }

    const timeMatch = gcode.match(
      /; estimated printing time \(normal mode\) = (.*)/,
    );
    if (timeMatch && timeMatch[1]) {
      const timeParts = timeMatch[1]
        .split(/d|h|m|s/)
        .map((s) => parseInt(s.trim()) || 0);
      printTimeSeconds =
        timeParts[0] * 24 * 3600 +
        timeParts[1] * 3600 +
        timeParts[2] * 60 +
        timeParts[3];
    }

    // Assuming PLA density (1.24 g/cm³) and 1.75mm diameter filament
    const filamentDiameterMm = 1.75;
    const filamentRadiusMm = filamentDiameterMm / 2;
    const filamentVolumeCm3 =
      Math.PI * Math.pow(filamentRadiusMm / 10, 2) * (filamentLengthMm / 10);
    const filamentDensityGramsPerCm3 = 1.24;
    const filamentUsedGrams = filamentVolumeCm3 * filamentDensityGramsPerCm3;
    const printTimeHours = printTimeSeconds / 3600;

    return { filamentUsedGrams, printTimeHours };
  }
}
