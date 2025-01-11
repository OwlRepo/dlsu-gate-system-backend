import {
  Controller,
  Post,
  Get,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ScreensaverService } from './screensaver.service';
import {
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { createReadStream } from 'fs';

@Controller('screensaver')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ScreensaverController {
  constructor(private readonly screensaverService: ScreensaverService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload screensaver image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadScreensaver(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only JPG, JPEG and PNG files are allowed');
    }

    return this.screensaverService.saveScreensaver(file);
  }

  @Get()
  @ApiOperation({ summary: 'Get current screensaver image' })
  async getScreensaver(): Promise<StreamableFile> {
    const filePath = await this.screensaverService.getScreensaverPath();
    const file = createReadStream(filePath);
    return new StreamableFile(file);
  }
}
