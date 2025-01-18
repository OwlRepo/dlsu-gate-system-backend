import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserDto } from './dto/user.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all users',
    description:
      'Retrieves a list of all users in the system regardless of their role',
  })
  @ApiOkResponse({
    description: 'List of users retrieved successfully',
    type: [UserDto],
    isArray: true,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token is missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have sufficient permissions',
  })
  async getAllUsers(): Promise<UserDto[]> {
    return this.usersService.getAllUsers();
  }

  @Get('admins')
  @ApiOperation({
    summary: 'Get all admin users',
    description: 'Retrieves a list of all users with administrator privileges',
  })
  @ApiOkResponse({
    description: 'List of admin users retrieved successfully',
    type: [UserDto],
    isArray: true,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token is missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have sufficient permissions',
  })
  async getAdminUsers(): Promise<UserDto[]> {
    return this.usersService.getAdminUsers();
  }

  @Get('employees')
  @ApiOperation({
    summary: 'Get all employee users',
    description: 'Retrieves a list of all users with employee role',
  })
  @ApiOkResponse({
    description: 'List of employee users retrieved successfully',
    type: [UserDto],
    isArray: true,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token is missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have sufficient permissions',
  })
  async getEmployeeUsers(): Promise<UserDto[]> {
    return this.usersService.getEmployeeUsers();
  }
}
