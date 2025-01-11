import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../employee/entities/employee.entity';
import { Admin } from '../admin/entities/admin.entity';
import { UserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
  ) {}

  async getAllUsers(): Promise<UserDto[]> {
    const [admins, employees] = await Promise.all([
      this.adminRepository.find(),
      this.employeeRepository.find(),
    ]);

    const adminUsers: UserDto[] = admins.map((admin) => ({
      id: admin.admin_id,
      username: admin.username,
      userType: 'admin',
    }));

    const employeeUsers: UserDto[] = employees.map((employee) => ({
      id: employee.employeeId,
      username: employee.username,
      userType: 'employee',
    }));

    return [...adminUsers, ...employeeUsers];
  }

  async getAdminUsers(): Promise<UserDto[]> {
    const admins = await this.adminRepository.find();
    return admins.map((admin) => ({
      id: admin.admin_id,
      username: admin.username,
      userType: 'admin',
    }));
  }

  async getEmployeeUsers(): Promise<UserDto[]> {
    const employees = await this.employeeRepository.find();
    return employees.map((employee) => ({
      id: employee.employeeId,
      username: employee.username,
      userType: 'employee',
    }));
  }
}
