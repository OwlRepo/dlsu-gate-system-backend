/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SuperAdminService } from '../../super-admin/super-admin.service';
import { SuperAdminLoginDto } from '../../super-admin/dto/super-admin.dto';
import * as bcrypt from 'bcryptjs';
import { SuperAdmin } from '../../super-admin/entities/super-admin.entity';

@Injectable()
export class SuperAdminAuthService {
  constructor(
    private superAdminService: SuperAdminService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: SuperAdminLoginDto) {
    const superAdmin = await this.superAdminService.findOneByUsername(
      loginDto.username,
    );

    if (!superAdmin) {
      throw new NotFoundException('Super Admin not found');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      superAdmin.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { password, ...userInfo } = superAdmin;
    const payload = {
      sub: superAdmin.super_admin_id,
      username: superAdmin.username,
      role: 'super-admin',
    };

    return {
      message: 'Admin authentication successful',
      access_token: 'Bearer ' + this.jwtService.sign(payload),
      user: userInfo,
    };
  }

  async getSuperAdminInfo(super_admin_id: string): Promise<SuperAdmin> {
    const superAdmin = await this.superAdminService.findOneById(super_admin_id);

    if (!superAdmin) {
      throw new NotFoundException('Super admin not found');
    }

    return superAdmin;
  }
}
