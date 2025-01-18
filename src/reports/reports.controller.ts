import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all reports',
    description:
      'Retrieves a list of all available reports. Requires Admin privileges.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of reports retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          // Add other report properties
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires Admin privileges',
  })
  findAll() {
    return this.reportsService.findAll();
  }

  @Get('search-contains')
  @ApiOperation({
    summary: 'Search reports',
    description: 'Search for reports containing the specified search string',
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
  })
  searchContains(@Query('searchString') searchString: string) {
    return this.reportsService.searchContains(searchString);
  }

  @Get('date-range')
  @ApiOperation({
    summary: 'Get reports by date range',
    description: 'Retrieves reports within the specified date range',
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
    description: 'Reports within date range retrieved successfully',
  })
  findByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.findByDateRange(startDate, endDate);
  }
}
