import { Controller, Get, Body, Patch, Param, Delete } from '@nestjs/common';
import { AdminService } from './admin.service';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @ApiOperation({ summary: 'Get all admins' })
  findAll() {
    return this.adminService.findAll();
  }

  @Get(':admin_id')
  @ApiOperation({ summary: 'Get admin by admin_id' })
  findOne(@Param('admin_id') admin_id: string) {
    return this.adminService.findByAdminId(admin_id);
  }

  @Patch(':admin_id')
  @ApiOperation({ summary: 'Update admin by admin_id' })
  @ApiBody({ type: UpdateAdminDto })
  update(
    @Param('admin_id') admin_id: string,
    @Body() updateAdminDto: UpdateAdminDto,
  ) {
    return this.adminService.update(admin_id, updateAdminDto);
  }

  @Delete(':admin_id')
  @ApiOperation({ summary: 'Delete admin by admin_id' })
  remove(@Param('admin_id') admin_id: string) {
    return this.adminService.remove(admin_id);
  }

  @Patch(':username')
  updateByUsername(
    @Param('username') username: string,
    @Body() updateAdminDto: UpdateAdminDto,
  ) {
    return this.adminService.updateByUsername(username, updateAdminDto);
  }
}
