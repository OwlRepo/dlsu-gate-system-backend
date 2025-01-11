import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SuperAdmin } from './entities/super-admin.entity';
import { Admin } from '../admin/entities/admin.entity';
import { CreateSuperAdminDto } from './dto/super-admin.dto';
import { CreateAdminDto } from '../admin/dto/create-admin.dto';
import {
  defaultSuperAdmin,
  defaultAdmin,
} from '../config/default-users.config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class SuperAdminService implements OnModuleInit {
  constructor(
    @InjectRepository(SuperAdmin)
    private superAdminRepository: Repository<SuperAdmin>,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
  ) {}

  async onModuleInit() {
    await this.initializeDefaultUsers();
  }

  private async initializeDefaultUsers() {
    try {
      // Check and create default super admin
      console.log('Checking for existing super admin...');
      const superAdminCount = await this.superAdminRepository.count();
      console.log('Super admin count:', superAdminCount);

      if (superAdminCount === 0) {
        console.log('Creating default super admin...');
        const result = await this.create({
          email: defaultSuperAdmin.email,
          password: 'superadmin123',
          name: defaultSuperAdmin.name,
          username: defaultSuperAdmin.username,
        });
        console.log('Default super admin created:', result);
      }

      // Check and create default admin
      console.log('Checking for existing admin...');
      const adminCount = await this.adminRepository.count();
      console.log('Admin count:', adminCount);

      if (adminCount === 0) {
        console.log('Creating default admin...');
        const result = await this.createAdmin({
          email: defaultAdmin.email,
          password: 'admin123',
          username: defaultAdmin.username,
          firstName: defaultAdmin.firstName,
          lastName: defaultAdmin.lastName,
          name: defaultAdmin.name,
          role: defaultAdmin.role,
        });
        console.log('Default admin created:', result);
      }
    } catch (error) {
      console.error('Error in initializeDefaultUsers:', error);
    }
  }

  private generateSecureAdminId(): string {
    const randomBytes = crypto.randomBytes(6);
    const randomHex = randomBytes.toString('hex').toUpperCase();
    return `ADM-${randomHex}`;
  }

  private generateSecureSuperAdminId(): string {
    const randomBytes = crypto.randomBytes(6);
    const randomHex = randomBytes.toString('hex').toUpperCase();
    return `SAD-${randomHex}`; // SAD prefix for Super ADmin
  }

  async findOneByEmail(email: string) {
    return this.superAdminRepository.findOne({ where: { email } });
  }

  async findOneByUsername(username: string) {
    return this.superAdminRepository.findOne({ where: { username } });
  }

  async createAdmin(createAdminDto: CreateAdminDto) {
    // Check for existing admin with same username
    const existingAdmin = await this.adminRepository.findOne({
      where: { username: createAdminDto.username },
    });

    if (existingAdmin) {
      throw new NotFoundException(
        `Admin with username ${createAdminDto.username} already exists`,
      );
    }

    // Check for existing admin with same email
    const existingEmail = await this.adminRepository.findOne({
      where: { email: createAdminDto.email },
    });

    if (existingEmail) {
      throw new NotFoundException(
        `Admin with email ${createAdminDto.email} already exists`,
      );
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(
      createAdminDto.password,
      saltRounds,
    );

    const admin = this.adminRepository.create({
      ...createAdminDto,
      adminId: this.generateSecureAdminId(),
      password: hashedPassword,
      role: 'admin',
      isActive: true,
    });

    const savedAdmin = await this.adminRepository.save(admin);
    return {
      ...savedAdmin,
      password: createAdminDto.password, // Return unhashed password
    };
  }

  async create(createSuperAdminDto: CreateSuperAdminDto) {
    const hashedPassword = await bcrypt.hash(createSuperAdminDto.password, 10);
    const superAdmin = this.superAdminRepository.create({
      email: createSuperAdminDto.email,
      password: hashedPassword,
      username: createSuperAdminDto.username,
      name: createSuperAdminDto.name,
      role: 'super-admin',
      superAdminId: this.generateSecureSuperAdminId(),
    });
    const savedSuperAdmin = await this.superAdminRepository.save(superAdmin);
    return {
      ...savedSuperAdmin,
      password: createSuperAdminDto.password, // Return unhashed password
    };
  }

  async findOneById(id: string): Promise<SuperAdmin> {
    return this.superAdminRepository.findOne({
      where: { superAdminId: id },
    });
  }
}
