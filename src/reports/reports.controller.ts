import {
  Controller,
  Get,
  Query,
  UseGuards,
  Post,
  Body,
  Res,
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
    description: `
      Search for reports containing the specified search string.
      
      Search covers:
      - Report title
      - Report content
      - Associated metadata
      - Tags
      
      Results are ordered by relevance and limited to 50 items.
      Partial matches are supported.
    `,
  })
  @ApiQuery({
    name: 'searchString',
    required: true,
    type: String,
    description: 'String to search for in reports. Minimum 3 characters.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reports matching search criteria',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          relevanceScore: { type: 'number' },
          matchedFields: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid search string' })
  searchContains(@Query('searchString') searchString: string) {
    return this.reportsService.searchContains(searchString);
  }

  @Get('date-range')
  @ApiOperation({
    summary: 'Get reports by date range',
    description: `
      Retrieves reports within the specified date range.
      
      Features:
      - Dates must be in YYYY-MM-DD format
      - Maximum range of 90 days
      - Results are sorted by date (newest first)
      - Includes both creation and modification dates
      - Timezone is UTC
    `,
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
          id: { type: 'string' },
          title: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          modifiedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid date format or range' })
  findByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.findByDateRange(startDate, endDate);
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
    description: `
      Generates and downloads a CSV report of all reports.
      
      CSV includes:
      - Report ID
      - Title
      - Creation date
      - Status
      - Associated metadata
      
      Features:
      - UTF-8 encoding
      - Includes headers
      - Automatic file cleanup after download
      - Maximum 10,000 records
    `,
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
    const { filePath, fileName } =
      await this.reportsService.generateCSVReport();

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
      }
      // Cleanup file after download
      this.reportsService.cleanupFile(filePath);
    });
  }
}
