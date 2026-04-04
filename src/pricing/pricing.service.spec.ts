import { Test, TestingModule } from "@nestjs/testing";
import { PricingService } from "./pricing.service";
import { ConfigService } from "../config/config.service";
import { PriceRequestDto, Quality, Infill } from "./dto/price-request.dto";
import * as child_process from "child_process";

jest.mock("child_process");

const mockSpawn = child_process.spawn as jest.Mock;

describe("PricingService", () => {
  let service: PricingService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        {
          provide: ConfigService,
          useValue: {
            tempDir: "/tmp/test",
            prusaSlicerPath: "/usr/bin/prusa-slicer",
            prusaConfigBundle: "/path/to/bundle.ini",
            filamentCostPerKg: 50,
            energyCostPerKwh: 0.2,
            printerPowerW: 200,
            hourlyRate: 10,
            maintenanceRatePerHour: 1,
            markupPct: 20,
            minJobFee: 5,
          },
        },
      ],
    }).compile();

    service = module.get<PricingService>(PricingService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("priceFromStl", () => {
    const tempFilename = "model.stl";
    const stlPath = "model.stl";
    const options: PriceRequestDto = {
      originalFilename: "model.stl",
      quality: Quality.STANDARD,
      infill: Infill.STANDARD,
    };
    const gcode = `
; total filament used [g] = 10.5
; estimated printing time (normal mode) = 1h 30m 15s
`;

    beforeEach(() => {
      const spawnEmitter = {
        on: jest.fn((event, callback) => {
          if (event === "close") {
            callback(0);
          }
          return spawnEmitter;
        }),
        stderr: { on: jest.fn() },
      };
      mockSpawn.mockReturnValue(spawnEmitter);

      // Mock fs.promises functions
      jest.spyOn(require("fs/promises"), "access").mockResolvedValue(undefined);
      jest.spyOn(require("fs/promises"), "readFile").mockResolvedValue(gcode);
      jest.spyOn(require("fs/promises"), "unlink").mockResolvedValue(undefined);
    });

    it("should calculate price correctly from STL", async () => {
      const result = await service.priceFromStl(stlPath, options);

      expect(mockSpawn).toHaveBeenCalledWith(
        "/usr/bin/prusa-slicer",
        expect.arrayContaining([
          "--load",
          "/path/to/bundle.ini",
          "--layer-height",
          "0.3",
          "--fill-density",
          "15%",
          "--gcode",
          "--output",
          expect.stringMatching(/slice-\d+\.gcode$/),
          "/tmp/test/model.stl",
        ]),
        { stdio: ["ignore", "pipe", "pipe"] },
      );

      expect(require("fs/promises").readFile).toHaveBeenCalledWith(
        expect.any(String),
        "utf8",
      );

      expect(result).toEqual({
        tempFilename: tempFilename,
        originalFilename: options.originalFilename,
        currency: "PLN",
        filamentCostPerKg: 50,
        energyCostPerKwh: 0.2,
        printerPowerW: 200,
        hourlyRate: 10,
        maintenanceRatePerHour: 1,
        markupPct: 20,
        minJobFee: 5,
        filamentG: 10.5,
        printTimeSeconds: 5415,
        materialCost: 0.53,
        energyCost: 0.06,
        laborCost: 15.04,
        maintenanceCost: 1.5,
        subtotal: 17.13,
        markupAmount: 3.43,
        totalBeforeMin: 20.56,
        totalPrintCost: 20.56,
      });

      expect(require("fs/promises").unlink).toHaveBeenCalledWith(
        expect.any(String),
      );
    });

    it("should throw an error if PrusaSlicer fails", async () => {
      const spawnEmitter = {
        on: jest.fn((event, callback) => {
          if (event === "close") {
            callback(1);
          }
          return spawnEmitter;
        }),
        stderr: {
          on: jest.fn((event, callback) => {
            if (event === "data") {
              callback("slicer error");
            }
          }),
        },
      };
      mockSpawn.mockReturnValue(spawnEmitter);

      await expect(service.priceFromStl(stlPath, options)).rejects.toThrow(
        "PrusaSlicer failed (1): slicer error",
      );
    });

    it("should throw an error if G-code parsing fails", async () => {
      require("fs/promises").readFile.mockResolvedValue("; no stats here");
      await expect(service.priceFromStl(stlPath, options)).rejects.toThrow(
        "Failed to parse necessary stats from G-code",
      );
    });
  });
});
