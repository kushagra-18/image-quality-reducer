import { Controller, Get, Post, Body, Param, UseInterceptors, UploadedFile, BadRequestException, HttpStatus } from '@nestjs/common';
import { ImageService } from './image.service';
import { UploadImageDto } from './dto/upload-image.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from 'src/configs/multer';
import { CsvValidator } from './validators/csv.validator';

@Controller('image')
export class ImageController {
  constructor(private readonly imageService: ImageService,
    private readonly csvValidator: CsvValidator,
  ) { }

  /**
   * @description Upload CSV file, validate the file and save it to the database
   * @param file 
   * @param uploadImageDto 
   * @returns 
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Body() uploadImageDto: UploadImageDto) {

    if (!file) {
      throw new BadRequestException('No file uploaded or file is not a CSV');
    }

    if (!await this.csvValidator.validateCsv(file.path)) {
      throw new BadRequestException('Invalid CSV file,Please check the sample file');
    }

    const uploadInfo = {
      email: uploadImageDto.email,
      filePath: file.path,
      fileName: file.filename,
    };

    try {
      const createdImage = await this.imageService.create(uploadInfo);
      if (!createdImage) {
        throw new BadRequestException('Failed to upload file');
      }

      const message = `CSV file uploaded successfully. Process ID: ${createdImage.id} .Use this ID to check the status of the generation process.`;

      return { message, id: createdImage.id, statusCode: HttpStatus.CREATED };

    } catch (error) {
      return { message: 'Failed to upload file', statusCode: HttpStatus.INTERNAL_SERVER_ERROR };
    }
  }

  @Get('status/:id')
  async checkStatus(@Param('id') id: string) {
    try {
      const data = await this.imageService.checkStatus(id);
      return { status: data, statusCode: HttpStatus.OK, message: 'Status retrieved successfully' };
    } catch (error) {
      throw error;
    }
  }

  @Get('download/:id')
  async download(@Param('id') id: string) {
    try {
      const data = await this.imageService.download(id);
      return { status: data, statusCode: HttpStatus.OK, message: 'Downloaded successfully' };
    } catch (error) {
      throw error;
    }
  }

}
