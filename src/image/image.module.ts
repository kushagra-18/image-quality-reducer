import { Module } from '@nestjs/common';
import { ImageService } from './image.service';
import { ImageController } from './image.controller';
import { Image,ImageSchema } from './schemas/image.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { CsvProcess } from './crons/csv.process';
import { CsvValidator } from './validators/csv.validator';
import { ImageProcessor } from './image.processor';

@Module({
  controllers: [ImageController],
  providers: [ImageService,CsvProcess,CsvValidator,ImageProcessor],
  imports: [MongooseModule.forFeature([{ name: Image.name, schema: ImageSchema }])],
  exports: [ImageService],
})
export class ImageModule {}
