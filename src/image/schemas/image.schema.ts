import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Status } from '../interface/status.enum';

export type ImageDocument = HydratedDocument<Image>;

@Schema({ timestamps: true ,collection: 'images',autoCreate: true})
export class Image {
  @Prop()
  email: string;

  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  status: Status;

  @Prop({ required: true })
  csv_name: string;

  @Prop({ required: true })
  csv_path: string;

  @Prop()
  csv_output_path: string;

  @Prop()
  errors: string;

  @Prop()
  webhook_url: string;
  
  @Prop()
  message: string;

}

export const ImageSchema = SchemaFactory.createForClass(Image);