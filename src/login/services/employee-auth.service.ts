import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Employee } from '../../employee/entities/employee.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class EmployeeAuthService {
  constructor(
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    private jwtService: JwtService,
  ) {}

  async validateEmployee(username: string, password: string) {
    const employee = await this.employeeRepository.findOne({
      where: { username },
    });

    if (!employee) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, employee.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return employee;
  }

  async login(employee: Employee) {
    const payload = {
      username: employee.username,
      sub: employee.id,
      role: 'employee',
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
