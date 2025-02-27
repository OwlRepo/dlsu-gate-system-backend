import {
  Controller,
  Get,
  Query,
  UseGuards,
  Post,
  Body,
  Res,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Response } from 'express';
import { CreateReportDto } from './dto/create-report.dto';
import { BasePaginationDto } from '../common/dto/base-pagination.dto';
import { IsOptional, IsEnum, IsDateString, MinLength } from 'class-validator';

// Add new DTO by extending BasePaginationDto
export class EnhancedReportQueryDto extends BasePaginationDto {
  @IsOptional()
  @IsEnum(['1', '2'], { message: 'Type must be either "1" or "2"' })
  type?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @MinLength(3, { message: 'Search term must be at least 3 characters long' })
  searchTerm?: string;
}

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all reports with pagination and filtering',
    description:
      'Retrieves a paginated list of reports with optional filtering by type, date range, and search term',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['1', '2'],
    description: 'Filter by report type (1=entry, 2=out)',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'searchTerm',
    required: false,
    type: String,
    description: 'Search in name, remarks (min 3 chars)',
  })
  async findAll(@Query() query: EnhancedReportQueryDto) {
    try {
      // Validate dates if provided
      if (
        (query.startDate && !query.endDate) ||
        (!query.startDate && query.endDate)
      ) {
        throw new UnprocessableEntityException(
          'Both startDate and endDate must be provided together',
        );
      }

      if (query.startDate && query.endDate) {
        const start = new Date(query.startDate);
        const end = new Date(query.endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          throw new UnprocessableEntityException(
            'Invalid date format. Use YYYY-MM-DD',
          );
        }
        if (start > end) {
          throw new UnprocessableEntityException(
            'Start date must be before or equal to end date',
          );
        }
      }

      return this.reportsService.findAll(query);
    } catch (error) {
      throw new UnprocessableEntityException(error.message);
    }
  }

  @Post()
  @ApiOperation({
    summary: 'Create new report',
    description: 'Creates a new report with the provided data',
  })
  @ApiResponse({
    status: 201,
    description: 'Report created successfully',
  })
  create(@Body() createReportDto: CreateReportDto) {
    return this.reportsService.create(createReportDto);
  }

  @Get('generate-csv')
  @ApiOperation({
    summary: 'Generate CSV report',
    description:
      'Generates and downloads a CSV report containing all reports data',
  })
  @ApiResponse({
    status: 200,
    description: 'CSV file download',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Error generating CSV',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Failed to generate CSV report' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async generateCSV(@Res() res: Response) {
    let filePath: string | undefined;

    try {
      const result = await this.reportsService.generateCSVReport();
      filePath = result.filePath;

      if (!filePath || !result.fileName) {
        throw new Error(
          'Failed to generate CSV file - missing file information',
        );
      }

      return res.download(filePath, result.fileName, (err) => {
        if (err) {
          console.error('Error during file download:', err);
          // Only cleanup if download failed
          if (filePath) {
            this.reportsService
              .cleanupFile(filePath)
              .catch((cleanupErr) =>
                console.error('Error cleaning up file:', cleanupErr),
              );
          }
          // Check if headers are not sent yet
          if (!res.headersSent) {
            res.status(500).json({
              statusCode: 500,
              message: 'Failed to download CSV file',
              error: 'Internal Server Error',
            });
          }
          return;
        }

        // Cleanup after successful download
        if (filePath) {
          this.reportsService
            .cleanupFile(filePath)
            .catch((cleanupErr) =>
              console.error(
                'Error cleaning up file after download:',
                cleanupErr,
              ),
            );
        }
      });
    } catch (error) {
      console.error('Error in CSV generation:', error);

      // Cleanup on error
      if (filePath) {
        try {
          await this.reportsService.cleanupFile(filePath);
        } catch (cleanupErr) {
          console.error(
            'Error cleaning up file after generation failure:',
            cleanupErr,
          );
        }
      }

      throw new UnprocessableEntityException({
        statusCode: 422,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to generate CSV report',
        error: 'Unprocessable Entity',
      });
    }
  }
}
