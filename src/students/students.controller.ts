import { Controller, Get, Query } from '@nestjs/common';
import { StudentsService } from './students.service';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { StudentPaginationDto } from './dto/student-pagination.dto';

@ApiTags('Students')
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all students with pagination',
    description:
      'Retrieves a paginated list of students with optional filtering',
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
    description: 'Search term for ID_Number or Name',
  })
  @ApiQuery({
    name: 'isArchived',
    required: false,
    type: Boolean,
    description: 'Filter by archive status',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated list of students',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              ID_Number: { type: 'string' },
              Name: { type: 'string' },
              Lived_Name: { type: 'number' },
              Remarks: { type: 'string' },
              Photo: { type: 'string' },
              Campus_Entry: { type: 'string' },
              Unique_ID: { type: 'number' },
              isArchived: { type: 'boolean' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
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
  findAll(@Query() query: StudentPaginationDto) {
    return this.studentsService.findAll(query);
  }
}
