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

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all reports with pagination',
    description:
      'Retrieves a paginated list of reports with optional filtering',
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
    name: 'search',
    required: false,
    type: String,
    description: 'Search term for name or remarks',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated list of reports',
    schema: {
      type: 'object',
      properties: {
        items: {
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
        total: { type: 'number', description: 'Total number of records' },
        page: { type: 'number', description: 'Current page' },
        limit: { type: 'number', description: 'Items per page' },
        totalPages: { type: 'number', description: 'Total number of pages' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  findAll(@Query() query: BasePaginationDto) {
    return this.reportsService.findAll(query);
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
      // Validate type parameter
      if (!type) {
        throw new Error('Type parameter is required');
      }

      // Ensure type is a string and matches allowed values
      const validTypes = ['0', '1'];
      if (!validTypes.includes(type)) {
        throw new Error(
          `Invalid type "${type}". Only types "0" and "1" are allowed.`,
        );
      }

      // Validate date parameters
      if (!startDate || !endDate) {
        throw new Error('Both startDate and endDate are required');
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        throw new Error('Invalid date format. Use YYYY-MM-DD format.');
      }

      // Validate date values
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid date values provided');
      }

      if (start > end) {
        throw new Error('Start date must be before or equal to end date');
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
