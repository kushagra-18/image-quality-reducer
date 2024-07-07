// src/images/dto/upload-image.dto.ts
import { IsEmail, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UploadImageDto {
  @ApiProperty()
  @IsOptional()
  @IsEmail()
  email: string;

  @ApiProperty({ type: 'string', format: 'binary' })
  @Type(() => String)
  file: any;
}
