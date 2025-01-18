import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { LoginService } from './login.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { Public } from '../auth/public.decorator';
import {
  ApiBody,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SuperAdminAuthService } from './services/super-admin-auth.service';
import { SuperAdminLoginDto } from '../super-admin/dto/super-admin.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from '@nestjs/common';
import { EmployeeAuthService } from './services/employee-auth.service';
import { JwtService } from '@nestjs/jwt';
import { ScreensaverService } from '../screensaver/screensaver.service';

@ApiTags('Authentication')
@Controller('auth')
export class LoginController {
  constructor(
    private readonly loginService: LoginService,
    private readonly superAdminAuthService: SuperAdminAuthService,
    private readonly employeeAuthService: EmployeeAuthService,
    private readonly jwtService: JwtService,
    private readonly screensaverService: ScreensaverService,
  ) {}

  @Public()
  @Post('admin')
  @ApiOperation({
    summary: 'Authenticate admin',
    description:
      'Authenticates an admin user and returns a JWT token. Public endpoint.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string', example: 'admin' },
        password: { type: 'string', example: 'password' },
      },
      required: ['username', 'password'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Admin successfully authenticated',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: 'string' },
            role: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid credentials',
  })
  authenticateAdmin(@Body() adminLoginDto: AdminLoginDto) {
    return this.loginService.validateAdminAuthentication(adminLoginDto);
  }

  @Public()
  @Post('super-admin')
  @ApiOperation({ summary: 'Authenticate super admin' })
  @ApiBody({
    schema: {
      example: { username: 'superadmin', password: 'password' },
    },
  })
  superAdminLogin(@Body() loginDto: SuperAdminLoginDto) {
    return this.superAdminAuthService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiOperation({
    summary: 'Logout user',
    description:
      'Logs out the user and invalidates their token. Requires authentication.',
  })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Successfully logged out' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid token' })
  async logout(@Request() req) {
    const token = req.headers.authorization?.split(' ')[1];
    return this.loginService.logout(token);
  }

  @Public()
  @Post('employee')
  @ApiOperation({ summary: 'Employee login' })
  @ApiBody({
    schema: {
      example: {
        username: 'john.doe',
        password: 'secretPassword123',
      },
    },
  })
  async employeeLogin(
    @Body() loginDto: { username: string; password: string },
  ) {
    const employee = await this.employeeAuthService.validateEmployee(
      loginDto.username,
      loginDto.password,
    );
    return this.employeeAuthService.login(employee);
  }

  @UseGuards(JwtAuthGuard)
  @Get('validate')
  @ApiOperation({
    summary: 'Validate token and return user information',
    description:
      'Validates the provided JWT token and returns the associated user information',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Token is valid, user information returned',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        username: { type: 'string' },
        role: { type: 'string' },
        // Add other relevant user properties
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async validateToken(@Request() req) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    const decodedToken = this.jwtService.decode(token);
    if (!decodedToken) {
      throw new UnauthorizedException('Invalid token');
    }

    const userType = decodedToken['role'];
    let userInfo;

    try {
      switch (userType) {
        case 'admin':
          userInfo = await this.loginService.getAdminInfo(decodedToken['sub']);
          break;
        case 'super-admin':
          userInfo = await this.superAdminAuthService.getSuperAdminInfo(
            decodedToken['sub'],
          );
          break;
        case 'employee':
          userInfo = await this.employeeAuthService.getEmployeeInfo(
            decodedToken['sub'],
          );
          userInfo.password = undefined;
          userInfo = {
            ...userInfo,
          };
          break;
        default:
          throw new UnauthorizedException('Invalid user type');
      }

      const { ...userInfoWithoutPassword } = userInfo;
      return userInfoWithoutPassword;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`${userType} not found`);
      }
      throw error;
    }
  }
}
