import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { Admin } from './entities/admin.entity';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
  ) {
    this.initializeExistingAdmins();
  }

  private async initializeExistingAdmins() {
    try {
      const admins = await this.adminRepository.find({
        where: { admin_id: null },
      });

      for (const admin of admins) {
        admin.admin_id = this.generateSecureAdminId();
        await this.adminRepository.save(admin);
      }
    } catch (error) {
      console.error('Error initializing existing admins:', error);
    }
  }

  private generateSecureAdminId(): string {
    // Generate a secure random string and format it as ADM-XXXXXXXXXXXX
    const randomBytes = crypto.randomBytes(6);
    const randomHex = randomBytes.toString('hex').toUpperCase();
    return `ADM-${randomHex}`;
  }

  async findAll() {
    return this.adminRepository.find();
  }

  async findOne(id: number) {
    const admin = await this.adminRepository.findOne({ where: { id } });
    if (!admin) {
      throw new NotFoundException(`Admin with ID ${id} not found`);
    }
    return admin;
  }

  async findByAdminId(admin_id: string) {
    const admin = await this.adminRepository.findOne({ where: { admin_id } });
    if (!admin) {
      throw new NotFoundException(`Admin with admin_id ${admin_id} not found`);
    }
    return admin;
  }

  async update(admin_id: string, updateAdminDto: UpdateAdminDto) {
    const admin = await this.findByAdminId(admin_id);

    if (updateAdminDto.email) {
      const existingEmail = await this.adminRepository.findOne({
        where: { email: updateAdminDto.email },
      });

      if (existingEmail && existingEmail.id !== admin.id) {
        throw new NotFoundException(
          `Admin with email ${updateAdminDto.email} already exists`,
        );
      }
    }

    if (updateAdminDto.password) {
      const saltRounds = 10;
      updateAdminDto.password = await bcrypt.hash(
        updateAdminDto.password,
        saltRounds,
      );
    }

    Object.assign(admin, updateAdminDto);
    return this.adminRepository.save(admin);
  }

  async remove(admin_id: string) {
    const admin = await this.findByAdminId(admin_id);
    await this.adminRepository.remove(admin);
    return {
      success: true,
      message: 'Admin deleted successfully',
    };
  }

  async updateByUsername(username: string, updateAdminDto: UpdateAdminDto) {
    const admin = await this.adminRepository.findOne({ where: { username } });
    if (!admin) {
      throw new NotFoundException(`Admin with username ${username} not found`);
    }
    Object.assign(admin, updateAdminDto);
    return this.adminRepository.save(admin);
  }
}
