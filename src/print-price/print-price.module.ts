import { Module } from "@nestjs/common";
import { PrintController } from "./print-price.controller";
import { PrintService } from "./print-price.service";
import { MulterModule } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: "./uploads",
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join("");
          return cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(stl)$/)) {
          return cb(new Error("Only STL files are allowed!"), false);
        }
        cb(null, true);
      },
    }),
  ],
  controllers: [PrintController],
  providers: [PrintService],
})
export class PrintModule {}
