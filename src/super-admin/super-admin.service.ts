import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SuperAdmin } from './entities/super-admin.entity';
import { Admin } from '../admin/entities/admin.entity';
import { CreateSuperAdminDto } from './dto/super-admin.dto';
import { CreateAdminDto } from '../admin/dto/create-admin.dto';
import {
  defaultSuperAdmin,
  defaultAdmin,
} from '../config/default-users.config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Table } from 'typeorm';
import { UpdateSuperAdminDto } from './dto/update-super-admin.dto';
import { AppDataSource } from '../config/typeorm.config';

@Injectable()
export class SuperAdminService implements OnModuleInit {
  constructor(
    @InjectRepository(SuperAdmin)
    private superAdminRepository: Repository<SuperAdmin>,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
    private dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.ensureTablesExist();
    await this.initializeDefaultUsers();
    await AppDataSource.initialize();
    await AppDataSource.runMigrations();
  }

  private async ensureTablesExist() {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      // Check if super_admin table exists
      const superAdminTableExists = await queryRunner.hasTable('super_admin');
      if (!superAdminTableExists) {
        console.log('Creating super_admin table...');
        await queryRunner.createTable(
          new Table({
            name: 'super_admin',
            columns: [
              {
                name: 'id',
                type: 'uuid',
                isPrimary: true,
                generationStrategy: 'uuid',
                default: 'uuid_generate_v4()',
              },
              {
                name: 'super_admin_id',
                type: 'varchar',
                isUnique: true,
              },
              {
                name: 'email',
                type: 'varchar',
                isUnique: true,
              },
              {
                name: 'password',
                type: 'varchar',
              },
              {
                name: 'username',
                type: 'varchar',
                isUnique: true,
              },
              {
                name: 'first_name',
                type: 'varchar',
                isNullable: false,
              },
              {
                name: 'last_name',
                type: 'varchar',
                isNullable: false,
              },
              {
                name: 'role',
                type: 'varchar',
              },
              {
                name: 'created_at',
                type: 'timestamp',
                default: 'CURRENT_TIMESTAMP',
              },
              {
                name: 'updated_at',
                type: 'timestamp',
                default: 'CURRENT_TIMESTAMP',
              },
            ],
          }),
          true,
        );
      }

      // Check if admin table exists
      const adminTableExists = await queryRunner.hasTable('admin');
      if (!adminTableExists) {
        console.log('Creating admin table...');
        await queryRunner.createTable(
          new Table({
            name: 'admin',
            columns: [
              {
                name: 'id',
                type: 'uuid',
                isPrimary: true,
                generationStrategy: 'uuid',
                default: 'uuid_generate_v4()',
              },
              {
                name: 'admin_id',
                type: 'varchar',
                isUnique: true,
              },
              {
                name: 'email',
                type: 'varchar',
                isUnique: true,
              },
              {
                name: 'password',
                type: 'varchar',
              },
              {
                name: 'username',
                type: 'varchar',
                isUnique: true,
              },
              {
                name: 'first_name',
                type: 'varchar',
                isNullable: false,
              },
              {
                name: 'last_name',
                type: 'varchar',
                isNullable: false,
              },
              {
                name: 'role',
                type: 'varchar',
              },
              {
                name: 'is_active',
                type: 'boolean',
                default: true,
              },
              {
                name: 'created_at',
                type: 'timestamp',
                default: 'CURRENT_TIMESTAMP',
              },
              {
                name: 'updated_at',
                type: 'timestamp',
                default: 'CURRENT_TIMESTAMP',
              },
            ],
          }),
          true,
        );
      }
    } catch (error) {
      console.error('Error ensuring tables exist:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
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
          first_name: defaultSuperAdmin.name.split(' ')[0],
          last_name: defaultSuperAdmin.name.split(' ')[1] || '',
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
          first_name: defaultAdmin.username,
          last_name: '',
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
      admin_id: this.generateSecureAdminId(),
      password: hashedPassword,
      role: 'admin',
      is_active: true,
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
      first_name: createSuperAdminDto.first_name,
      last_name: createSuperAdminDto.last_name,
      role: 'super-admin',
      super_admin_id: this.generateSecureSuperAdminId(),
    });
    const savedSuperAdmin = await this.superAdminRepository.save(superAdmin);
    return {
      ...savedSuperAdmin,
      password: createSuperAdminDto.password,
    };
  }

  async findOneById(id: string): Promise<SuperAdmin> {
    return this.superAdminRepository.findOne({
      where: { super_admin_id: id },
    });
  }

  async update(id: string, updateSuperAdminDto: UpdateSuperAdminDto) {
    const superAdmin = await this.superAdminRepository.findOne({
      where: { super_admin_id: id },
    });

    if (!superAdmin) {
      throw new NotFoundException('Super admin not found');
    }

    // If password is provided, hash it before saving
    if (updateSuperAdminDto.password) {
      updateSuperAdminDto.password = await bcrypt.hash(
        updateSuperAdminDto.password,
        10,
      );
    }

    await this.superAdminRepository.update(
      { super_admin_id: id },
      updateSuperAdminDto,
    );
    return this.superAdminRepository.findOne({
      where: { super_admin_id: id },
    });
  }
}
