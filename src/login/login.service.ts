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
import * as bcrypt from 'bcrypt';
import { TokenBlacklistService } from '../auth/token-blacklist.service';

@Injectable()
export class LoginService {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  async validateAdminAuthentication(adminLoginDto: AdminLoginDto) {
    const admin = await this.adminRepository.findOne({
      where: { username: adminLoginDto.username },
    });

    if (!admin) {
      throw new UnauthorizedException(
        `Admin with username "${adminLoginDto.username}" not found`,
      );
    }

    const isPasswordValid = await bcrypt.compare(
      adminLoginDto.password,
      admin.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'Incorrect password provided for admin account',
      );
    }

    const payload = {
      username: admin.username,
      sub: admin.id,
      role: 'admin',
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

  async getAdminInfo(adminId: number): Promise<Admin> {
    const admin = await this.adminRepository.findOne({
      where: { id: adminId },
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    return admin;
  }
}
