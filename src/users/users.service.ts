import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../employee/entities/employee.entity';
import { Admin } from '../admin/entities/admin.entity';
import { UserDto } from './dto/user.dto';
import { SuperAdmin } from 'src/super-admin/entities/super-admin.entity';

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

  async getAllUsers(): Promise<UserDto[]> {
    const [admins, employees, superAdmins] = await Promise.all([
      this.adminRepository.find({ select: { password: false } }),
      this.employeeRepository.find({ select: { password: false } }),
      this.superAdminRepository.find({ select: { password: false } }),
    ]);

    const adminUsers: UserDto[] = admins.map((admin) => ({
      ...admin,
      id: admin.admin_id,
      userType: 'admin',
    }));

    const employeeUsers: UserDto[] = employees.map(
      (employee: Omit<Employee, 'password'>) => ({
        ...employee,
        id: employee.employee_id,
        userType: 'employee',
      }),
    );

    const superAdminUsers: UserDto[] = superAdmins.map(
      (superAdmin: Omit<SuperAdmin, 'password'>) => ({
        ...superAdmin,
        id: superAdmin.super_admin_id,
        userType: 'super-admin',
      }),
    );

    return [...adminUsers, ...employeeUsers, ...superAdminUsers];
  }

  async getAdminUsers(): Promise<UserDto[]> {
    const admins = await this.adminRepository.find({
      select: { password: false },
    });
    return admins.map((admin) => ({
      ...admin,
      id: admin.admin_id,
      userType: 'admin',
    }));
  }

  async getEmployeeUsers(): Promise<UserDto[]> {
    const employees = await this.employeeRepository.find({
      select: { password: false },
    });
    return employees.map((employee) => ({
      ...employee,
      id: employee.employee_id,
      userType: 'employee',
    }));
  }

  async getSuperAdminUsers(): Promise<UserDto[]> {
    const superAdmins = await this.superAdminRepository.find({
      select: { password: false },
    });
    return superAdmins.map((superAdmin) => ({
      ...superAdmin,
      id: superAdmin.super_admin_id,
      userType: 'super-admin',
    }));
  }
}
