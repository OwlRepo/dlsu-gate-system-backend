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
      'Updates an existing super admin account. Requires Super Admin privileges.',
  })
  @ApiBody({
    type: UpdateSuperAdminDto,
    description: 'Super admin update data',
  })
  @ApiResponse({
    status: 200,
    description: 'Super admin successfully updated',
    type: UpdateSuperAdminDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid data' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires Super Admin privileges',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Super admin not found',
  })
  async updateSuperAdmin(
    @Param('id') id: string,
    @Body() updateSuperAdminDto: UpdateSuperAdminDto,
    @Req() req,
  ) {
    if (req.user.role !== 'super-admin') {
      throw new ForbiddenException(
        'Only super admins can update super admin accounts',
      );
    }
    return this.superAdminService.update(id, updateSuperAdminDto);
  }
}
