import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../employee/entities/employee.entity';
import { Admin } from '../admin/entities/admin.entity';
import { UserDto } from './dto/user.dto';
import { SuperAdmin } from 'src/super-admin/entities/super-admin.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UserPaginationDto } from './dto/user-pagination.dto';
import { Role } from 'src/auth/enums/role.enum';
import { Response } from 'express';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
    @InjectRepository(SuperAdmin)
    private superAdminRepository: Repository<SuperAdmin>,
  ) {}

  async getAllUsers(query: UserPaginationDto): Promise<any> {
    const { page = 1, limit = 10, search, type, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const allUsers: UserDto[] = [];

    // Helper function to build date conditions
    const getDateCondition = (type: string) => {
      const dateCondition =
        type === 'admin' || type === 'super-admin'
          ? 'created_at'
          : 'date_created';
      if (startDate && endDate) {
        return `AND ${dateCondition} BETWEEN :startDate AND :endDate`;
      }
      return '';
    };

    const dateParams = startDate && endDate ? { startDate, endDate } : {};

    if (!type || type === 'admin') {
      const admins = await this.adminRepository
        .createQueryBuilder('admin')
        .where(
          search
            ? 'admin.username LIKE :search OR admin.email LIKE :search OR admin.first_name LIKE :search OR admin.last_name LIKE :search ' +
                getDateCondition('admin')
            : '1=1 ' + getDateCondition('admin'),
          {
            search: `%${search}%`,
            ...dateParams,
          },
        )
        .getMany();
      allUsers.push(
        ...admins.map((admin) => ({
          id: admin.admin_id,
          username: admin.username,
          email: admin.email,
          first_name: admin.first_name,
          last_name: admin.last_name,
          userType: 'admin' as const,
          created_at: new Date(admin.created_at),
        })),
      );
    }

    if (!type || type === 'employee') {
      const employees = await this.employeeRepository
        .createQueryBuilder('employee')
        .where(
          search
            ? 'employee.username LIKE :search OR employee.email LIKE :search OR employee.first_name LIKE :search OR employee.last_name LIKE :search ' +
                getDateCondition('employee')
            : '1=1 ' + getDateCondition('employee'),
          {
            search: `%${search}%`,
            ...dateParams,
          },
        )
        .getMany();
      allUsers.push(
        ...employees.map((employee) => ({
          id: employee.employee_id,
          username: employee.username,
          email: employee.email,
          first_name: employee.first_name,
          last_name: employee.last_name,
          userType: 'employee' as const,
          created_at: new Date(employee.date_created),
        })),
      );
    }

    if (!type || type === 'super-admin') {
      const superAdmins = await this.superAdminRepository
        .createQueryBuilder('superAdmin')
        .where(
          search
            ? 'superAdmin.username LIKE :search OR superAdmin.email LIKE :search OR superAdmin.first_name LIKE :search OR superAdmin.last_name LIKE :search ' +
                getDateCondition('super-admin')
            : '1=1 ' + getDateCondition('super-admin'),
          {
            search: `%${search}%`,
            ...dateParams,
          },
        )
        .getMany();
      allUsers.push(
        ...superAdmins.map((superAdmin) => ({
          id: superAdmin.super_admin_id,
          username: superAdmin.username,
          email: superAdmin.email,
          first_name: superAdmin.first_name,
          last_name: superAdmin.last_name,
          userType: 'super-admin' as const,
          created_at: new Date(),
        })),
      );
    }

    const total = allUsers.length;
    const items = allUsers.slice(skip, skip + limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAdminUsers(query: PaginationQueryDto): Promise<any> {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.adminRepository.createQueryBuilder('admin');

    if (search) {
      queryBuilder.where(
        '(admin.username LIKE :search OR admin.email LIKE :search OR admin.first_name LIKE :search OR admin.last_name LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [admins, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const items = admins.map((admin) => ({
      id: admin.admin_id,
      username: admin.username,
      email: admin.email,
      first_name: admin.first_name,
      last_name: admin.last_name,
      userType: 'admin' as const,
      created_at: new Date(admin.created_at),
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getEmployeeUsers(query: PaginationQueryDto): Promise<any> {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.employeeRepository.createQueryBuilder('employee');

    if (search) {
      queryBuilder.where(
        '(employee.username LIKE :search OR employee.email LIKE :search OR employee.first_name LIKE :search OR employee.last_name LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [employees, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const items = employees.map((employee) => ({
      id: employee.employee_id,
      username: employee.username,
      email: employee.email,
      first_name: employee.first_name,
      last_name: employee.last_name,
      userType: 'employee' as const,
      created_at: new Date(employee.date_created),
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSuperAdminUsers(): Promise<UserDto[]> {
    const superAdmins = await this.superAdminRepository.find({
      select: { password: false },
    });
    return superAdmins.map((superAdmin) => ({
      id: superAdmin.super_admin_id,
      username: superAdmin.username,
      email: superAdmin.email,
      first_name: superAdmin.first_name,
      last_name: superAdmin.last_name,
      userType: 'super-admin' as const,
      created_at: new Date(),
    }));
  }

  async generateUsersCsv(
    types: (Role.ADMIN | Role.EMPLOYEE | Role.SUPER_ADMIN)[],
    startDate: string,
    endDate: string,
  ): Promise<string> {
    const users: UserDto[] = [];

    // Helper function to build date conditions
    const getDateCondition = (userType: string) => {
      const dateCondition =
        userType === 'admin' || userType === 'super-admin'
          ? 'created_at'
          : 'date_created';
      return `${dateCondition} BETWEEN :startDate AND :endDate`;
    };

    const dateParams = { startDate, endDate };

    // Fetch users for each requested type
    for (const type of types) {
      switch (type) {
        case Role.ADMIN:
          const admins = await this.adminRepository
            .createQueryBuilder('admin')
            .where(getDateCondition('admin'), dateParams)
            .orderBy('admin.created_at', 'ASC')
            .getMany();

          users.push(
            ...admins.map((admin) => ({
              id: admin.admin_id,
              username: admin.username,
              email: admin.email,
              first_name: admin.first_name,
              last_name: admin.last_name,
              userType: 'admin' as const,
              created_at: new Date(admin.created_at),
            })),
          );
          break;

        case Role.EMPLOYEE:
          const employees = await this.employeeRepository
            .createQueryBuilder('employee')
            .where(getDateCondition('employee'), dateParams)
            .orderBy('employee.date_created', 'ASC')
            .getMany();

          users.push(
            ...employees.map((employee) => ({
              id: employee.employee_id,
              username: employee.username,
              email: employee.email,
              first_name: employee.first_name,
              last_name: employee.last_name,
              userType: 'employee' as const,
              created_at: new Date(employee.date_created),
            })),
          );
          break;

        case Role.SUPER_ADMIN:
          const superAdmins = await this.superAdminRepository
            .createQueryBuilder('superAdmin')
            .where(getDateCondition('super-admin'), dateParams)
            .orderBy('superAdmin.created_at', 'ASC')
            .getMany();

          users.push(
            ...superAdmins.map((superAdmin) => ({
              id: superAdmin.super_admin_id,
              username: superAdmin.username,
              email: superAdmin.email,
              first_name: superAdmin.first_name,
              last_name: superAdmin.last_name,
              userType: 'super-admin' as const,
              created_at: new Date(superAdmin.created_at),
            })),
          );
          break;
      }
    }

    // Sort all users by creation date
    users.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

    // Generate CSV header
    const headers = [
      'ID',
      'Username',
      'Email',
      'First Name',
      'Last Name',
      'User Type',
      'Created At',
    ];

    // Generate CSV rows
    const rows = users.map((user) => [
      user.id,
      user.username,
      user.email,
      user.first_name,
      user.last_name,
      user.userType,
      user.created_at.toISOString(),
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    return csvContent;
  }

  async streamUsersCsv(
    types: Role[],
    startDate: string,
    endDate: string,
    res: Response,
  ): Promise<void> {
    // Write CSV headers
    const headers = [
      'ID',
      'Username',
      'Email',
      'First Name',
      'Last Name',
      'User Type',
      'Created At',
    ];
    res.write(headers.join(',') + '\n');

    const dateParams = { startDate, endDate };

    // Helper function to build date conditions
    const getDateCondition = (userType: string) => {
      const dateCondition =
        userType === 'admin' || userType === 'super-admin'
          ? 'created_at'
          : 'date_created';
      return `${dateCondition} BETWEEN :startDate AND :endDate`;
    };

    // Process each type sequentially
    for (const type of types) {
      let users: any[] = [];

      switch (type) {
        case Role.ADMIN:
          users = await this.adminRepository
            .createQueryBuilder('admin')
            .where(getDateCondition('admin'), dateParams)
            .orderBy('admin.created_at', 'ASC')
            .getMany();

          for (const user of users) {
            const row = [
              user.admin_id,
              user.username,
              user.email,
              user.first_name,
              user.last_name,
              'admin',
              new Date(user.created_at).toISOString(),
            ]
              .map((field) => `"${field}"`)
              .join(',');
            res.write(row + '\n');
          }
          break;

        case Role.EMPLOYEE:
          users = await this.employeeRepository
            .createQueryBuilder('employee')
            .where(getDateCondition('employee'), dateParams)
            .orderBy('employee.date_created', 'ASC')
            .getMany();

          for (const user of users) {
            const row = [
              user.employee_id,
              user.username,
              user.email,
              user.first_name,
              user.last_name,
              'employee',
              new Date(user.date_created).toISOString(),
            ]
              .map((field) => `"${field}"`)
              .join(',');
            res.write(row + '\n');
          }
          break;

        case Role.SUPER_ADMIN:
          users = await this.superAdminRepository
            .createQueryBuilder('superAdmin')
            .where(getDateCondition('super-admin'), dateParams)
            .orderBy('superAdmin.created_at', 'ASC')
            .getMany();

          for (const user of users) {
            const row = [
              user.super_admin_id,
              user.username,
              user.email,
              user.first_name,
              user.last_name,
              'super-admin',
              new Date(user.created_at).toISOString(),
            ]
              .map((field) => `"${field}"`)
              .join(',');
            res.write(row + '\n');
          }
          break;
      }
    }

    res.end();
  }
}
