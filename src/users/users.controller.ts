import {
  Controller,
  Get,
  Query,
  UnprocessableEntityException,
  Res,
  Header,
  ValidationPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ApiBearerAuth } from '@nestjs/swagger';
import { UserPaginationDto } from './dto/user-pagination.dto';
import { Response } from 'express';
import { Role } from 'src/auth/enums/role.enum';
import { GenerateCsvDto } from './dto/generate-csv.dto';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all users with pagination',
    description:
      'Retrieves a paginated list of users in the system. Can be filtered by user type, search term, and date range.',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description:
      'Filter users by type (admin, employee, super-admin). If not provided, returns all users',
    enum: ['admin', 'employee', 'super-admin'],
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
    description: 'Search term for username or email',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Filter users created from this date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Filter users created until this date (YYYY-MM-DD)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated list of users',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              username: { type: 'string' },
              email: { type: 'string' },
              first_name: { type: 'string' },
              last_name: { type: 'string' },
              userType: {
                type: 'string',
                enum: ['admin', 'employee', 'super-admin'],
              },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
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
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token is missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have sufficient permissions',
  })
  async getAllUsers(@Query() query: UserPaginationDto) {
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

    return this.usersService.getAllUsers(query);
  }

  @Get('generate-csv')
  @Header('Content-Type', 'text/csv')
  @ApiOperation({
    summary: 'Generate CSV file of users',
    description:
      'Generates and downloads a CSV file containing user data based on types and date range',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns a CSV file containing user data',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid date range or types',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token is missing or invalid',
  })
  async generateUsersCsv(
    @Query(new ValidationPipe({ transform: true })) query: GenerateCsvDto,
    @Res() res: Response,
  ) {
    // Validate date range (6 months maximum)
    const start = new Date(query.startDate);
    const end = new Date(query.endDate);
    const sixMonthsInMs = 6 * 30 * 24 * 60 * 60 * 1000;

    if (end.getTime() - start.getTime() > sixMonthsInMs) {
      throw new UnprocessableEntityException(
        'Date range cannot exceed 6 months',
      );
    }

    if (start > end) {
      throw new UnprocessableEntityException(
        'Start date must be before or equal to end date',
      );
    }

    const filename = `users-${query.types.join('-')}-${query.startDate}-${query.endDate}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    return this.usersService.streamUsersCsv(
      query.types as Role[],
      query.startDate,
      query.endDate,
      res,
    );
  }
}
