import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CRON_EXPRESSION } from 'src/constants/cron.constant';
import { ImageService } from '../image.service';

@Injectable()
export class CsvProcess {
    private readonly logger = new Logger(CsvProcess.name);

    constructor(
        private readonly imageService: ImageService,
    ) { }

    @Cron(CRON_EXPRESSION.EVERY_5_SECONDS)
    handleCron() {
        try {
            this.imageService.processCsv();
        } catch (error) {
            this.logger.error(error);
        }
    }
}