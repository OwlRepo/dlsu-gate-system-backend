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
import { ApiTags, ApiBody, ApiOperation } from '@nestjs/swagger';

@ApiTags('Employee')
@Controller('employee')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new employee' })
  @ApiBody({
    schema: {
      example: {
        username: 'john.doe',
        password: 'secretPassword123',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        is_active: true,
        deviceId: ['1234567890', '1234567891'],
      },
    },
  })
  create(@Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeeService.create(createEmployeeDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all employees' })
  findAll() {
    return this.employeeService.findAll();
  }

  @Get(':idOrUsername')
  @ApiOperation({ summary: 'Get employee by ID or username' })
  findOne(@Param('idOrUsername') idOrUsername: string) {
    return this.employeeService.findOne(idOrUsername);
  }

  @Get('device/:deviceId')
  @ApiOperation({ summary: 'Get employee by device ID' })
  findByDeviceId(@Param('deviceId') deviceId: string) {
    return this.employeeService.findByDeviceId(deviceId);
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

  @Patch(':employeeId')
  @ApiOperation({ summary: 'Update employee by ID' })
  @ApiBody({
    schema: {
      example: {
        first_name: 'John',
        last_name: 'Doe',
        password: 'newPassword123',
        is_active: true,
        deviceId: ['1234567890', '1234567891'],
      },
    },
  })
  update(
    @Param('employeeId') employeeId: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ) {
    return this.employeeService.update(employeeId, updateEmployeeDto);
  }

  @Delete(':employeeId')
  @ApiOperation({ summary: 'Delete employee by ID' })
  remove(@Param('employeeId') employeeId: string) {
    return this.employeeService.remove(employeeId);
  }
}
