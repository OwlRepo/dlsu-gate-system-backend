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

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all reports',
    description: 'Retrieves all reports with complete data from the database',
  })
  @ApiResponse({
    status: 200,
    description: 'List of reports retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          datetime: { type: 'string', format: 'date-time' },
          type: { type: 'string' },
          user_id: { type: 'string' },
          name: { type: 'string' },
          remarks: { type: 'string' },
          status: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  findAll() {
    return this.reportsService.findAll();
  }

  @Get('search-contains')
  @ApiOperation({
    summary: 'Search reports',
    description:
      'Search for reports containing the specified search string in name, remarks, or type',
  })
  @ApiQuery({
    name: 'searchString',
    required: true,
    type: String,
    description: 'String to search for in reports',
  })
  @ApiResponse({
    status: 200,
    description: 'Reports matching search criteria',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          datetime: { type: 'string', format: 'date-time' },
          type: { type: 'string' },
          user_id: { type: 'string' },
          name: { type: 'string' },
          remarks: { type: 'string' },
          status: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({
    status: 422,
    description: 'Invalid search string',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 422 },
        message: {
          type: 'string',
          example: 'Search string must be at least 3 characters long',
        },
        error: { type: 'string', example: 'Unprocessable Entity' },
      },
    },
  })
  searchContains(@Query('searchString') searchString: string) {
    try {
      if (!searchString || searchString.length < 3) {
        throw new Error('Search string must be at least 3 characters long');
      }
      return this.reportsService.searchContains(searchString);
    } catch (error) {
      throw new UnprocessableEntityException(error.message);
    }
  }

  @Get('date-range')
  @ApiOperation({
    summary: 'Get reports by date range',
    description:
      'Retrieves reports within the specified date range with complete data',
  })
  @ApiQuery({
    name: 'startDate',
    required: true,
    type: String,
    description: 'Start date in YYYY-MM-DD format',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    type: String,
    description: 'End date in YYYY-MM-DD format',
  })
  @ApiResponse({
    status: 200,
    description: 'Reports within date range',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          datetime: { type: 'string', format: 'date-time' },
          type: { type: 'string' },
          user_id: { type: 'string' },
          name: { type: 'string' },
          remarks: { type: 'string' },
          status: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({
    status: 422,
    description: 'Invalid date format',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 422 },
        message: {
          type: 'string',
          example: 'Invalid date format. Use YYYY-MM-DD format.',
        },
        error: { type: 'string', example: 'Unprocessable Entity' },
      },
    },
  })
  findByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    try {
      // Validate date format
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
      ) {
        throw new Error('Invalid date format. Use YYYY-MM-DD format.');
      }
      return this.reportsService.findByDateRange(startDate, endDate);
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
  @ApiResponse({ status: 500, description: 'Error generating CSV' })
  async generateCSV(@Res() res: Response) {
    try {
      const { filePath, fileName } =
        await this.reportsService.generateCSVReport();

      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error('Error downloading file:', err);
        }
        // Cleanup file after download
        this.reportsService.cleanupFile(filePath);
      });
    } catch (error) {
      console.error('Error generating CSV file:', error);
      throw new UnprocessableEntityException('Error generating CSV file');
    }
  }

  @Get('by-type')
  @ApiOperation({
    summary: 'Get reports by type',
    description: 'Retrieves reports filtered by type (0 or 1)',
  })
  @ApiQuery({
    name: 'type',
    required: true,
    type: String,
    enum: ['0', '1'],
    description: 'Report type to filter by',
  })
  @ApiResponse({
    status: 200,
    description: 'Reports retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          datetime: { type: 'string', format: 'date-time' },
          type: { type: 'string', enum: ['0', '1'] },
          user_id: { type: 'string' },
          name: { type: 'string' },
          remarks: { type: 'string' },
          status: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({
    status: 422,
    description: 'Invalid type provided',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 422 },
        message: {
          type: 'string',
          example: 'Invalid type. Only types "0" and "1" are allowed.',
        },
        error: { type: 'string', example: 'Unprocessable Entity' },
      },
    },
  })
  findByType(@Query('type') type: string) {
    try {
      return this.reportsService.findByType(type);
    } catch (error) {
      throw new UnprocessableEntityException(error.message);
    }
  }

  @Get('type-date-range')
  @ApiOperation({
    summary: 'Get reports by type and date range',
    description:
      'Retrieves reports filtered by type and date range. Optionally returns data as CSV file.',
  })
  @ApiQuery({
    name: 'type',
    required: true,
    type: String,
    enum: ['0', '1'],
    description: 'Report type to filter by (0 or 1)',
  })
  @ApiQuery({
    name: 'startDate',
    required: true,
    type: String,
    description: 'Start date in YYYY-MM-DD format',
    example: '2024-03-01',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    type: String,
    description: 'End date in YYYY-MM-DD format',
    example: '2024-03-31',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    type: String,
    enum: ['json', 'csv'],
    description:
      'Optional response format - use "json" for table data or "csv" for downloadable file (default: json)',
    example: 'json',
  })
  @ApiResponse({
    status: 200,
    description:
      'Reports retrieved successfully. Returns JSON data for tables or downloadable CSV file.',
    schema: {
      oneOf: [
        {
          type: 'object',
          description: 'JSON response for table rendering (when format=json)',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  datetime: { type: 'string', format: 'date-time' },
                  type: { type: 'string', enum: ['0', '1'] },
                  user_id: { type: 'string' },
                  name: { type: 'string' },
                  remarks: { type: 'string' },
                  status: { type: 'string' },
                  created_at: { type: 'string', format: 'date-time' },
                },
              },
            },
            total: { type: 'number', description: 'Total number of records' },
            message: { type: 'string' },
          },
        },
        {
          type: 'string',
          format: 'binary',
          description: 'Downloadable CSV file (when format=csv)',
        },
      ],
    },
  })
  @ApiResponse({
    status: 422,
    description: 'Validation error',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 422 },
        message: {
          type: 'string',
          example: 'Invalid type. Only types "0" and "1" are allowed.',
        },
        error: { type: 'string', example: 'Unprocessable Entity' },
      },
    },
  })
  async findByTypeAndDateRange(
    @Query('type') type: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('format') format = 'json',
    @Res() res: Response,
  ) {
    try {
      if (type !== '0' && type !== '1') {
        throw new Error('Invalid type. Only types "0" and "1" are allowed.');
      }
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
      ) {
        throw new Error('Invalid date format. Use YYYY-MM-DD format.');
      }

      const reports = await this.reportsService.findByTypeAndDateRange(
        type,
        startDate,
        endDate,
      );

      if (format === 'csv') {
        const { filePath, fileName } =
          await this.reportsService.generateCSVReport(reports);
        return res.download(filePath, fileName, (err) => {
          if (err) {
            console.error('Error downloading file:', err);
          }
          this.reportsService.cleanupFile(filePath);
        });
      }

      return res.json({
        data: reports,
        total: reports.length,
        message: 'Reports retrieved successfully',
      });
    } catch (error) {
      throw new UnprocessableEntityException(error.message);
    }
  }
}
