import {
  Controller,
  Get,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ApiBearerAuth } from '@nestjs/swagger';
import { UserPaginationDto } from './dto/user-pagination.dto';

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
}
