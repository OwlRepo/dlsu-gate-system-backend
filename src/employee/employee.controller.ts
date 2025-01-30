import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@ApiTags('Employees')
@ApiBearerAuth()
@Controller('employee')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
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
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
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

  @Get('created')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get employees created within a date range' })
  @ApiResponse({
    status: 200,
    description: 'List of employees created within the date range',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            email: 'john.doe@example.com',
            employee_id: 'EMP1234',
            username: 'john.doe',
            first_name: 'John',
            last_name: 'Doe',
            device_id: ['1234567890'],
            is_active: true,
            date_created: '2024-03-20T10:00:00.000Z',
            date_activated: '2024-03-20T10:00:00.000Z',
            date_deactivated: null,
          },
        ],
      },
    },
  })
  findByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    console.log('startDate', startDate);
    console.log('endDate', endDate);
    return this.employeeService.findByDateRange(startDate, endDate);
  }

  @Get('device/:device_id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get employee by device ID' })
  findByDeviceId(@Param('device_id') device_id: string) {
    return this.employeeService.findByDeviceId(device_id);
  }

  @Get(':idOrUsername')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
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

  @Patch(':employee_id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update employee by ID',
    description:
      'Update specific fields of an employee. All fields are optional and only provided fields will be updated. ' +
      'Fields that are not included in the request will remain unchanged.',
  })
  @ApiBody({
    type: UpdateEmployeeDto,
    examples: {
      passwordOnly: {
        summary: 'Update password only',
        value: {
          password: 'newpassword123',
        },
      },
      namesOnly: {
        summary: 'Update names only',
        value: {
          first_name: 'John',
          last_name: 'Doe',
        },
      },
      emailOnly: {
        summary: 'Update email only',
        value: {
          email: 'new.email@example.com',
        },
      },
      statusOnly: {
        summary: 'Update active status only',
        value: {
          is_active: false,
        },
      },
      devicesOnly: {
        summary: 'Update device IDs only',
        value: {
          device_id: ['DEVICE123', 'DEVICE456'],
        },
      },
      multipleFields: {
        summary: 'Update multiple fields',
        value: {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
          password: 'newpassword123',
          is_active: true,
          device_id: ['DEVICE123'],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Employee has been successfully updated',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        employee_id: 'EMP123',
        username: 'johndoe',
        email: 'john.doe@example.com',
        first_name: 'John',
        last_name: 'Doe',
        is_active: true,
        device_id: ['DEVICE123'],
        date_created: '2024-03-20T10:00:00.000Z',
        date_activated: '2024-03-20T10:00:00.000Z',
        date_deactivated: null,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires Admin privileges',
  })
  update(
    @Param('employee_id') employee_id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ) {
    return this.employeeService.update(employee_id, updateEmployeeDto);
  }

  @Delete(':employee_id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete employee by ID' })
  remove(@Param('employee_id') employee_id: string) {
    return this.employeeService.remove(employee_id);
  }

  @Patch(':employee_id/deactivate')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Deactivate a single employee',
    description:
      'Deactivates an employee by setting their is_active status to false',
  })
  @ApiResponse({
    status: 200,
    description: 'Employee successfully deactivated',
    schema: {
      example: {
        success: true,
        message: 'Employee deactivated successfully',
        data: {
          employee_id: '123e4567-e89b-12d3-a456-426614174000',
          is_active: false,
          date_deactivated: '2024-03-21T10:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  deactivateEmployee(@Param('employee_id') employee_id: string) {
    return this.employeeService.deactivateEmployee(employee_id);
  }

  @Post('bulk-deactivate')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Deactivate multiple employees',
    description:
      'Deactivates multiple employees by their employee IDs. Employee IDs should be in the format "EMP1234".',
  })
  @ApiBody({
    schema: {
      example: {
        employee_ids: ['EMP1234', 'EMP5678'],
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Employees successfully deactivated',
    schema: {
      example: {
        success: true,
        message: 'Employees deactivated successfully',
        data: {
          deactivated_count: 2,
          deactivated_employees: [
            {
              employee_id: '123e4567-e89b-12d3-a456-426614174000',
              is_active: false,
              date_deactivated: '2024-03-21T10:00:00.000Z',
            },
            {
              employee_id: '123e4567-e89b-12d3-a456-426614174001',
              is_active: false,
              date_deactivated: '2024-03-21T10:00:00.000Z',
            },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid employee IDs',
  })
  bulkDeactivateEmployees(@Body() body: { employee_ids: string[] }) {
    return this.employeeService.bulkDeactivateEmployees(body.employee_ids);
  }
}
