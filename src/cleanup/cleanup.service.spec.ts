import { Test, TestingModule } from "@nestjs/testing";
import { CleanupService } from "./cleanup.service";
import { ConfigService } from "../config/config.service";
import { CronExpression } from "@nestjs/schedule";
import * as fs from "fs/promises";
import { Logger } from "@nestjs/common";

jest.mock("fs/promises");
jest.mock("@nestjs/common", () => ({
  ...jest.requireActual("@nestjs/common"),
  Logger: jest.fn(() => ({
    log: jest.fn(),
    error: jest.fn(),
  })),
}));

const mockFsReaddir = fs.readdir as jest.Mock;
const mockFsStat = fs.stat as jest.Mock;
const mockFsUnlink = fs.unlink as jest.Mock;

describe("CleanupService", () => {
  let service: CleanupService;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupService,
        {
          provide: ConfigService,
          useValue: {
            tempDir: "/tmp/test-cleanup",
          },
        },
      ],
    }).compile();

    service = module.get<CleanupService>(CleanupService);
    // This is a bit of a hack to get the mocked logger instance
    logger = (service as any).logger;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("handleCron", () => {
    it("should delete old temporary files", async () => {
      const now = Date.now();
      const oldFile = "slice-old.gcode";
      const newFile = "upload-new.stl";
      const ignoredFile = "some-other-file.txt";

      const files = [oldFile, newFile, ignoredFile];
      mockFsReaddir.mockResolvedValue(files);

      mockFsStat.mockImplementation(async (filePath) => {
        if (filePath.endsWith(oldFile)) {
          return { mtime: new Date(now - 25 * 60 * 60 * 1000) }; // 25 hours old
        }
        if (filePath.endsWith(newFile)) {
          return { mtime: new Date(now - 1 * 60 * 60 * 1000) }; // 1 hour old
        }
        return { mtime: new Date(now) };
      });

      mockFsUnlink.mockResolvedValue(undefined);

      await service.handleCron();

      expect(logger.log).toHaveBeenCalledWith(
        "Running scheduled cleanup of temporary files..."
      );
      expect(mockFsReaddir).toHaveBeenCalledWith("/tmp/test-cleanup");
      expect(mockFsStat).toHaveBeenCalledTimes(2); // oldFile and newFile
      expect(mockFsUnlink).toHaveBeenCalledTimes(1);
      expect(mockFsUnlink).toHaveBeenCalledWith(
        expect.stringContaining(oldFile)
      );
      expect(logger.log).toHaveBeenCalledWith(
        `Deleted old temporary file: /tmp/test-cleanup/${oldFile}`
      );
      expect(mockFsUnlink).not.toHaveBeenCalledWith(
        expect.stringContaining(newFile)
      );
      expect(mockFsUnlink).not.toHaveBeenCalledWith(
        expect.stringContaining(ignoredFile)
      );
    });

    it("should log a message if the temp directory does not exist", async () => {
      const error = new Error("Not found") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      mockFsReaddir.mockRejectedValue(error);

      await service.handleCron();

      expect(logger.log).toHaveBeenCalledWith(
        "Running scheduled cleanup of temporary files..."
      );
      expect(logger.log).toHaveBeenCalledWith(
        "Temporary directory /tmp/test-cleanup not found, skipping cleanup."
      );
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("should log an error if reading the temp directory fails for other reasons", async () => {
      const error = new Error("Permission denied");
      mockFsReaddir.mockRejectedValue(error);

      await service.handleCron();

      expect(logger.log).toHaveBeenCalledWith(
        "Running scheduled cleanup of temporary files..."
      );
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to read temporary directory /tmp/test-cleanup: Permission denied"
      );
    });

    it("should log an error if stat fails for a file", async () => {
      const files = ["slice-file1.gcode"];
      mockFsReaddir.mockResolvedValue(files);

      const statError = new Error("Stat failed");
      mockFsStat.mockRejectedValue(statError);

      await service.handleCron();

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to process file /tmp/test-cleanup/slice-file1.gcode: Stat failed"
      );
      expect(mockFsUnlink).not.toHaveBeenCalled();
    });
  });
});
