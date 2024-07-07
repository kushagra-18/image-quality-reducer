import { Injectable } from '@nestjs/common';
import * as csvParser from 'csv-parser';
import * as fs from 'fs';

@Injectable()
export class CsvValidator {

    async validateCsv(filePath: string): Promise<boolean> {
        const expectedHeaders = ['S. No.', 'Product Name', 'Input Image Urls'];
        let isValid = true;

        try {
            const stream = fs.createReadStream(filePath)
                .pipe(csvParser({ separator: ',' }));

            const headers = await new Promise<string[]>((resolve, reject) => {
                stream.on('headers', (h) => resolve(h));
            });

            if (headers.length !== expectedHeaders.length ||
                !expectedHeaders.every((value, index) => value === headers[index])) {
                isValid = false;
            }
        } catch (error) {
            isValid = false;
        }

        return isValid;
    }

}
