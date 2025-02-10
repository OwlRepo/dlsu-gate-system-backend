/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminLoginDto } from './dto/admin-login.dto';
import { Admin } from '../admin/entities/admin.entity';
import { SuperAdmin } from '../super-admin/entities/super-admin.entity';
import * as bcrypt from 'bcryptjs';
import { TokenBlacklistService } from '../auth/token-blacklist.service';
import { Role } from 'src/auth/enums/role.enum';

@Injectable()
export class LoginService {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    @InjectRepository(SuperAdmin)
    private readonly superAdminRepository: Repository<SuperAdmin>,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  async validateAdminAuthentication(adminLoginDto: AdminLoginDto) {
    // First try super admin
    const superAdmin = await this.superAdminRepository.findOne({
      where: { username: adminLoginDto.username },
    });

    if (superAdmin) {
      const isPasswordValid = await bcrypt.compare(
        adminLoginDto.password,
        superAdmin.password,
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const payload = {
        username: superAdmin.username,
        sub: superAdmin.id,
        role: Role.SUPER_ADMIN,
      };

      return {
        message: 'Super Admin authentication successful',
        access_token: 'Bearer ' + this.jwtService.sign(payload),
      };
    }

    // Then try regular admin
    const admin = await this.adminRepository.findOne({
      where: { username: adminLoginDto.username },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      adminLoginDto.password,
      admin.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      username: admin.username,
      sub: admin.id,
      role: 'ADMIN',
    };

    return {
      message: 'Admin authentication successful',
      access_token: 'Bearer ' + this.jwtService.sign(payload),
    };
  }

  async logout(token: string) {
    await this.tokenBlacklistService.blacklistToken(token);
    return { message: 'Logged out successfully' };
  }

  async getAdminInfo(admin_id: number): Promise<Admin> {
    const admin = await this.adminRepository.findOne({
      where: { id: admin_id },
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    return admin;
  }
}
