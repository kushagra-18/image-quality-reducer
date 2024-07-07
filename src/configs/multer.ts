// src/config/multer.config.ts
import { diskStorage } from 'multer';
import { extname } from 'path';

export const multerConfig = {
  storage: diskStorage({
    destination: './uploads', // Path where files will be stored
    filename: (req, file, callback) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = extname(file.originalname);
      callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
  }),
  fileFilter: (req: any, file: { mimetype: string; }, callback: (arg0: Error, arg1: boolean) => void) => {
    if (file.mimetype !== 'text/csv') {
      return callback(new Error('Only CSV files are allowed'), false);
    }
    callback(null, true);
  },
};
