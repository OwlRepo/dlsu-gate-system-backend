import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import {
  ApiTags,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('Employees')
@ApiBearerAuth()
@Controller('employee')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new employee',
    description:
      'Creates a new employee with the provided information. Requires Admin privileges.',
  })
  @ApiBody({
    type: CreateEmployeeDto,
    description: 'Employee creation data',
    examples: {
      example1: {
        value: {
          username: 'john.doe',
          password: 'secretPassword123',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
          is_active: true,
          device_id: ['1234567890'],
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Employee successfully created',
    type: CreateEmployeeDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid data' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires Admin privileges',
  })
  create(@Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeeService.create(createEmployeeDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all employees',
    description: 'Retrieves all employees. Requires Admin privileges.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all employees',
    type: [CreateEmployeeDto],
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires Admin privileges',
  })
  findAll() {
    return this.employeeService.findAll();
  }

  @Get(':idOrUsername')
  @ApiOperation({
    summary: 'Get employee by ID or username',
    description: 'Retrieves an employee using either their ID or username',
  })
  @ApiParam({
    name: 'idOrUsername',
    description: 'Employee ID or username',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Employee found',
    type: CreateEmployeeDto,
  })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  findOne(@Param('idOrUsername') idOrUsername: string) {
    return this.employeeService.findOne(idOrUsername);
  }

  @Get('device/:device_id')
  @ApiOperation({ summary: 'Get employee by device ID' })
  findByDeviceId(@Param('device_id') device_id: string) {
    return this.employeeService.findByDeviceId(device_id);
  }

  @Get('created')
  @ApiOperation({ summary: 'Get employees created within a date range' })
  @ApiBody({
    schema: {
      example: {
        startDate: '2024-03-01',
        endDate: '2024-03-31',
      },
    },
  })
  findByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.employeeService.findByDateRange(startDate, endDate);
  }

  @Patch(':employee_id')
  @ApiOperation({ summary: 'Update employee by ID' })
  @ApiBody({
    schema: {
      example: {
        first_name: 'John',
        last_name: 'Doe',
        password: 'newPassword123',
        is_active: true,
        device_id: ['1234567890', '1234567891'],
      },
    },
  })
  update(
    @Param('employee_id') employee_id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ) {
    return this.employeeService.update(employee_id, updateEmployeeDto);
  }

  @Delete(':employee_id')
  @ApiOperation({ summary: 'Delete employee by ID' })
  remove(@Param('employee_id') employee_id: string) {
    return this.employeeService.remove(employee_id);
  }
}
