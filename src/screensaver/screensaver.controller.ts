import {
  Controller,
  Post,
  Get,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
  Headers,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ScreensaverService } from './screensaver.service';
import {
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiTags,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

@ApiTags('Screensaver')
@Controller('screensaver')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ScreensaverController {
  constructor(
    private readonly screensaverService: ScreensaverService,
    private configService: ConfigService,
  ) {}

  @Post('upload')
  @ApiOperation({
    summary: 'Upload screensaver image',
    description:
      'Upload a new screensaver image. Supports JPG, JPEG and PNG formats.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file to upload (JPG, JPEG, or PNG)',
        },
      },
    },
  })
  @ApiHeader({
    name: 'Authorization',
    description: 'JWT Bearer token',
    required: true,
  })
  @ApiResponse({
    status: 201,
    description: 'Screensaver image successfully uploaded',
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL of the uploaded screensaver image',
        },
        filename: {
          type: 'string',
          description: 'Name of the uploaded file',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid file type or no file uploaded',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadScreensaver(
    @UploadedFile() file: Express.Multer.File,
    @Headers('authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only JPG, JPEG and PNG files are allowed');
    }

    return this.screensaverService.saveScreensaver(file, token);
  }

  @Get()
  @ApiOperation({
    summary: 'Get current screensaver image URL',
    description:
      'Retrieve information about the currently set screensaver image',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved screensaver information',
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL of the current screensaver image',
        },
        lastUpdated: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp of when the screensaver was last updated',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'No screensaver image found',
  })
  async getScreensaver() {
    return await this.screensaverService.getScreensaverInfo();
  }
}
