import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Image } from './schemas/image.schema';
import { Model } from 'mongoose';
import { Status } from './interface/status.enum';
import { ImageProcessor } from './image.processor';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';


@Injectable()
export class ImageService {

  private readonly logger = new Logger(ImageService.name);

  constructor(
    @InjectModel(Image.name) private imageModel: Model<Image>,
    private readonly imageProcessor: ImageProcessor,
  ) { }
  create(uploadImageData: { email: string; filePath: string; fileName: string; }) {

    const image = new this.imageModel({
      email: uploadImageData.email,
      csv_name: uploadImageData.fileName,
      csv_path: uploadImageData.filePath,
      status: Status.PENDING,
      id: this.generateRandomId(7),
    });

    return image.save();

  }

  async checkStatus(id: string) {
    const data = await this.imageModel.findOne({ id });

    if (!data) {
      throw new NotFoundException('No data found');
    }

    return data.status;
  }

  generateRandomId(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  async processCsv() {
    const images = await this.imageModel.find({ status: Status.PENDING });

    if (images.length === 0) {
      this.logger.log('No pending images found');
      return;
    }

    for (const image of images) {
      this.logger.log(`Processing ${image.csv_name}`);

      image.status = Status.PROCESSING;

      await image.save();

      try {
        const data = await this.imageProcessor.processCsv(image);

        image.csv_output_path = data.csvOutputPathWithFileName;

        image.errors = image.errors;

        image.status = Status.SUCCESS;

        if (image.webhook_url) {
          await this.hitWebhook(process.env.WEBHOOK_URL);
        }

        await image.save();
      } catch (error) {
        image.status = Status.FAILED;
        await image.save();
      }
      this.logger.log(`Processed ${image.csv_name}`);
    }
  }

  async download(id: string) {

    const image = await this.imageModel.findOne({ id });

    if (image.status !== Status.SUCCESS) {
      throw new BadRequestException('Images are not yet processed');
    }

    if (!image) {
      throw new NotFoundException('No data found');
    }

    const filePath = image.csv_output_path;

    const publicFilePath = path.resolve(__dirname, '..', '..', 'public', filePath);

    if (!fs.existsSync(publicFilePath)) {
      throw new NotFoundException('No data found');
    }

    const fileName = image.csv_name;

    const fileUrl = process.env.APP_URL + filePath;

    return {
      fileUrl,
      fileName,
    };
  }


  async hitWebhook(url: string) {
    const response = await axios.post(url);
    return response.data;
  }
}
