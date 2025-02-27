import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../employee/entities/employee.entity';
import { Admin } from '../admin/entities/admin.entity';
import { UserDto } from './dto/user.dto';
import { SuperAdmin } from 'src/super-admin/entities/super-admin.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UserPaginationDto } from './dto/user-pagination.dto';

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
    const getDateCondition = () => {
      if (startDate && endDate) {
        return 'AND created_at BETWEEN :startDate AND :endDate';
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
                getDateCondition()
            : '1=1 ' + getDateCondition(),
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
          updated_at: new Date(admin.created_at),
        })),
      );
    }

    if (!type || type === 'employee') {
      const employees = await this.employeeRepository
        .createQueryBuilder('employee')
        .where(
          search
            ? 'employee.username LIKE :search OR employee.email LIKE :search OR employee.first_name LIKE :search OR employee.last_name LIKE :search ' +
                getDateCondition()
            : '1=1 ' + getDateCondition(),
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
          updated_at: new Date(employee.date_created),
        })),
      );
    }

    if (!type || type === 'super-admin') {
      const superAdmins = await this.superAdminRepository
        .createQueryBuilder('superAdmin')
        .where(
          search
            ? 'superAdmin.username LIKE :search OR superAdmin.email LIKE :search OR superAdmin.first_name LIKE :search OR superAdmin.last_name LIKE :search ' +
                getDateCondition()
            : '1=1 ' + getDateCondition(),
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
          updated_at: new Date(),
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
      updated_at: new Date(admin.created_at),
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
      updated_at: new Date(employee.date_created),
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
      updated_at: new Date(),
    }));
  }
}
