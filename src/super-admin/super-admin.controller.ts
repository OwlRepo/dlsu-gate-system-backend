import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
  Patch,
  Param,
} from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { CreateSuperAdminDto } from './dto/super-admin.dto';
import { CreateAdminDto } from '../admin/dto/create-admin.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UpdateSuperAdminDto } from './dto/update-super-admin.dto';

@ApiTags('Super Admin')
@ApiBearerAuth()
@Controller('super-admin')
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @UseGuards(JwtAuthGuard)
  @Post('register')
  @ApiOperation({
    summary: 'Register a new super admin',
    description:
      'Creates a new super admin account. Requires existing Super Admin privileges.',
  })
  @ApiBody({
    type: CreateSuperAdminDto,
    description: 'Super admin creation data',
  })
  @ApiResponse({
    status: 201,
    description: 'Super admin successfully created',
    type: CreateSuperAdminDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid data' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires Super Admin privileges',
  })
  create(@Body() createSuperAdminDto: CreateSuperAdminDto) {
    return this.superAdminService.create(createSuperAdminDto);
  }

  @Post('create-admin')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Create a new admin',
    description:
      'Creates a new admin account. Requires Super Admin privileges.',
  })
  @ApiBody({
    type: CreateAdminDto,
    description: 'Admin creation data',
  })
  @ApiResponse({
    status: 201,
    description: 'Admin successfully created',
    type: CreateAdminDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid data' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires Super Admin privileges',
  })
  async createAdmin(@Body() createAdminDto: CreateAdminDto, @Req() req) {
    if (req.user.role !== 'super-admin') {
      throw new ForbiddenException('Only super admins can create new admins');
    }
    return this.superAdminService.createAdmin(createAdminDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Update a super admin',
    description:
      'Update specific fields of a super admin. All fields are optional and only provided fields will be updated.',
  })
  @ApiBody({
    type: UpdateSuperAdminDto,
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
      multipleFields: {
        summary: 'Update multiple fields',
        value: {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
          password: 'newpassword123',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Super admin has been successfully updated',
    schema: {
      example: {
        id: 1,
        super_admin_id: 'SAD-123ABC',
        username: 'johndoe',
        email: 'john.doe@example.com',
        first_name: 'John',
        last_name: 'Doe',
        role: 'super-admin',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Super admin not found' })
  async update(
    @Param('id') id: string,
    @Body() updateSuperAdminDto: UpdateSuperAdminDto,
  ) {
    return this.superAdminService.update(id, updateSuperAdminDto);
  }
}
