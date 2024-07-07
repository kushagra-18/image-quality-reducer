import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Image } from './schemas/image.schema';
import * as fs from 'fs';
import * as csvParser from 'csv-parser';
import axios from 'axios';
import * as path from 'path';
import { createSlug } from '../helpers';
import * as sharp from 'sharp';
import * as dotenv from 'dotenv';
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

dotenv.config();
@Injectable()
export class ImageProcessor {

    private readonly logger = new Logger(ImageProcessor.name);

    private failedUrls: string[] = [];
    private appUrl: string;

    constructor(
    ) {
        this.appUrl = process.env.APP_URL;
    }

    async processCsv(image: Image) {

        const reqId = image.id;
        const csvPath = image.csv_path;

        const csvData = await this.readCsvFile(csvPath);

        const InvalidUrl: string[] = [];

        for (const row of csvData) {
            const data = await this.validateAndProcessURLs(row, InvalidUrl, reqId);

            const path = data.imagesPath;
            const productSlug = data.productSlug;

            const pathContents = await this.readContentsOfPath(path);

            if (pathContents.length === 0) {
                this.logger.warn(`No images found in ${path}`);
                continue;
            }

            let outputImageUrls = '';

            for (const imagePath of pathContents) {
                const imageUrl = `${this.appUrl}/process_images/${reqId}/${productSlug}/${imagePath}`;
                outputImageUrls += imageUrl + ",";
            }

            outputImageUrls = outputImageUrls.slice(0, -1);

            row["Output Image Urls"] = outputImageUrls;
        }

        const rootPath = path.resolve(__dirname, '..', '..');
        const csvOutputPath = path.resolve(rootPath, 'public', 'csv_output', reqId);
        if (!fs.existsSync(csvOutputPath)) {
            fs.mkdirSync(csvOutputPath, { recursive: true });
        }

        // get relative  output path
        const relativeOutputPath = path.relative(rootPath, csvOutputPath);

        let csvOutputPathWithFileName = relativeOutputPath + '/' + reqId + '.csv';

        csvOutputPathWithFileName = csvOutputPathWithFileName.replace('public/', '');

        const csvWriter = createCsvWriter({
            path: `${csvOutputPath}/${reqId}.csv`,
            header: [
                { id: 'Product Name', title: 'Product Name' },
                { id: 'Input Image Urls', title: 'Input Image Urls' },
                { id: 'Output Image Urls', title: 'Output Image Urls' },
            ],
        });

        await csvWriter.writeRecords(csvData);

        const errors = this.failedUrls.length > 0 ? JSON.stringify(this.failedUrls) : '';

        return {
            csvOutputPathWithFileName,
            errors,
        }
    }

    /**
     * @description Validates the urls in the csv file and processes them
     * @param row 
     * @param InvalidUrl 
     * @param reqId 
     */
    private async validateAndProcessURLs(row: any, InvalidUrl: string[], reqId: string) {
        const imageUrlsArray = row["Input Image Urls"].split(",").map((url: string) => url.trim());

        const promises = imageUrlsArray.map(async (url: string) => {
            if (!await this.isValidUrl(url)) {
                InvalidUrl.push(url);
                this.logger.warn(`Invalid image url "${url}" in row "${row["Product Name"]}"`);
                return null;
            }
            return url;
        });

        const validImageUrls = (await Promise.all(promises)).filter(url => url !== null);

        const productSlug = createSlug(row["Product Name"]);

        const imagesPath = await this.processImages(validImageUrls, reqId, productSlug);

        return {
            imagesPath,
            productSlug,
        }

    }

    async isValidUrl(url: string) {
        try {
            new URL(url);
            return true;
        } catch (e) {
            return false;
        }
    }

    async processImages(imageUrls: string[], reqId: string, slug: string) {

        const data = await this.downloadImages(imageUrls, reqId, slug);

        const imagesPath = data.downloadsPath;
        const failedDownloadedImages = data.failedDownloadedImages;

        if (failedDownloadedImages.length > 0) {
            this.logger.warn(`Failed to download  some images for ${reqId} and ${slug}`);
        }

        const rootPath = path.resolve(__dirname, '..', '..');
        const processedImagesPath = path.resolve(rootPath, 'public', 'process_images', reqId, slug);

        if (!fs.existsSync(processedImagesPath)) {
            fs.mkdirSync(processedImagesPath, { recursive: true });
        }

        const imageFilesPath = fs.readdirSync(imagesPath);

        const processPromises = imageFilesPath.map(async (file) => {
            const filePath = path.resolve(imagesPath, file);
            const outputFilePath = path.resolve(processedImagesPath, file);

            await this.reduceQuality(filePath, 50, outputFilePath);
        });

        await Promise.all(processPromises).then(() => {
            this.logger.log('All images processed and saved to:', processedImagesPath);
        });

        return imagesPath;
    }

    async reduceQuality(inputPath: string, quality: number, outputPath: string) {
        try {
            await sharp(inputPath)
                .jpeg({ quality })
                .toFile(outputPath);
        } catch (error) {
            console.error('Error reducing image quality:', error);
        }
    }

    /**
     * @description Downloads images from the provided urls, also stores them in the downloads folder
     * along with the request id and slug, if the download fails, it is stored in the failed array
     * @param imageUrls 
     * @param reqId 
     * @param slug 
     * @returns 
     */
    async downloadImages(imageUrls: string[], reqId: string, slug: string) {
        let downloadsPath = '';
        let failedDownloadedImages: string[] = [];

        const rootPath = path.resolve(__dirname, '..', '..');
        downloadsPath = path.resolve(rootPath, 'downloads', reqId, slug);

        if (!fs.existsSync(downloadsPath)) {
            try {
                fs.mkdirSync(downloadsPath, { recursive: true });
            } catch (error) {
                throw new Error('Error creating downloads directory');
            }
        }

        for (const [index, imageUrl] of imageUrls.entries()) {
            try {
                const response = await axios({
                    method: 'get',
                    url: imageUrl,
                    responseType: 'stream',
                });

                const timeStamp = new Date().getTime();
                const filePath = path.resolve(downloadsPath, `${reqId}-${timeStamp}-${index}.jpg`);
                const writer = fs.createWriteStream(filePath);

                response.data.pipe(writer);

                await new Promise<void>((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });
            } catch (error) {
                this.logger.error(`Error downloading image from ${imageUrl}:`, error);
                failedDownloadedImages.push(imageUrl);
            }
        }

        const data = {
            downloadsPath,
            failedDownloadedImages
        };

        this.failedUrls = this.failedUrls.concat(failedDownloadedImages);

        return data;
    }

    private async readCsvFile(csvPath: string): Promise<any[]> {
        return new Promise<any[]>((resolve, reject) => {
            const rows: any[] = [];
            const stream = fs.createReadStream(csvPath)
                .pipe(csvParser())
                .on('data', (row) => rows.push(row))
                .on('end', () => resolve(rows))
                .on('error', (error) => reject(error));

            stream.on('error', (error) => reject(error)); // Handle stream errors
        });
    }

    private async readContentsOfPath(currentPath: string): Promise<string[]> {
        try {
            const contents = await fs.promises.readdir(currentPath);
            return contents;
        } catch (error) {
            this.logger.error(`Error reading contents of ${currentPath}: ${error}`);
            return [];
        }
    }
}
