/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository, DataSource, Table } from 'typeorm';
import { Employee } from './entities/employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class EmployeeService implements OnModuleInit {
  constructor(
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    private dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.ensureTablesExist();
  }

  private async ensureTablesExist() {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      // Check if employee table exists
      const employeeTableExists = await queryRunner.hasTable('employee');
      if (!employeeTableExists) {
        console.log('Creating employee table...');
        await queryRunner.createTable(
          new Table({
            name: 'employee',
            columns: [
              {
                name: 'id',
                type: 'uuid',
                isPrimary: true,
                generationStrategy: 'uuid',
                default: 'uuid_generate_v4()',
              },
              {
                name: 'email',
                type: 'varchar',
                isUnique: true,
              },
              {
                name: 'employee_id',
                type: 'varchar',
                isUnique: true,
              },
              {
                name: 'username',
                type: 'varchar',
                isUnique: true,
              },
              {
                name: 'password',
                type: 'varchar',
              },
              {
                name: 'first_name',
                type: 'varchar',
              },
              {
                name: 'last_name',
                type: 'varchar',
              },
              {
                name: 'device_id',
                type: 'json',
              },
              {
                name: 'is_active',
                type: 'boolean',
                default: true,
              },
              {
                name: 'date_created',
                type: 'timestamp',
                default: 'CURRENT_TIMESTAMP',
              },
              {
                name: 'date_activated',
                type: 'timestamp',
                default: 'CURRENT_TIMESTAMP',
              },
              {
                name: 'date_deactivated',
                type: 'timestamp',
                isNullable: true,
              },
            ],
          }),
          true,
        );
      }
    } catch (error) {
      console.error('Error ensuring employee table exists:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async create(createEmployeeDto: CreateEmployeeDto) {
    try {
      // Check if device_id array is empty
      if (
        !createEmployeeDto.device_id ||
        createEmployeeDto.device_id.length === 0
      ) {
        return {
          success: false,
          message: 'At least one device ID is required',
        };
      }

      // Check for duplicate device IDs
      const uniqueDeviceIds = new Set(createEmployeeDto.device_id);
      if (uniqueDeviceIds.size !== createEmployeeDto.device_id.length) {
        return {
          success: false,
          message: 'Duplicate device IDs are not allowed',
        };
      }

      // Check for existing username
      const existingUsername = await this.employeeRepository.findOne({
        where: { username: createEmployeeDto.username },
      });

      if (existingUsername) {
        return {
          success: false,
          message:
            'Username already exists. Please choose a different username.',
        };
      }

      const now = new Date();
      const generatedemployee_id = `EMP${Math.floor(Math.random() * 10000)}`;

      // Check for existing employee_id
      const existingemployee_id = await this.employeeRepository.findOne({
        where: { employee_id: generatedemployee_id },
      });

      if (existingemployee_id) {
        return {
          success: false,
          message: 'Generated Employee ID already exists. Please try again.',
        };
      }

      // Hash the password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(
        createEmployeeDto.password,
        saltRounds,
      );

      // Create employee with hashed password
      const employee = await this.employeeRepository.create({
        ...createEmployeeDto,
        password: hashedPassword,
        employee_id: generatedemployee_id,
        is_active: true,
        date_created: now.toISOString(),
        date_activated: now.toISOString(),
        date_deactivated: null,
      });

      // Save to database
      const savedEmployee = await this.employeeRepository.save(employee);

      // Return the response without the hashed password
      const { password, ...employeeWithoutPassword } = savedEmployee;
      return {
        success: true,
        data: employeeWithoutPassword,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findAll() {
    try {
      const employees = await this.employeeRepository.find();
      return {
        success: true,
        data: employees,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findOne(idOrUsername: string) {
    try {
      const employee = await this.employeeRepository.findOne({
        where: [{ employee_id: idOrUsername }, { username: idOrUsername }],
      });
      if (!employee) {
        return {
          success: false,
          message: 'Employee not found',
        };
      }
      return {
        success: true,
        data: employee,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findByDeviceId(device_id: string) {
    try {
      const employees = await this.employeeRepository.find();
      const filteredEmployees = employees.filter(
        (employee) =>
          employee.device_id && employee.device_id.includes(device_id),
      );

      if (filteredEmployees.length === 0) {
        return {
          success: false,
          message: 'No employees found with the given device ID',
        };
      }

      return {
        success: true,
        data: filteredEmployees,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findByDateRange(startDate: string, endDate: string) {
    try {
      const employees = await this.employeeRepository.find({
        where: { date_created: Between(startDate, endDate) },
      });
      return {
        success: true,
        data: employees,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async update(employee_id: string, updateEmployeeDto: UpdateEmployeeDto) {
    try {
      const allowedUpdates = {
        username: updateEmployeeDto.username,
        first_name: updateEmployeeDto.first_name,
        last_name: updateEmployeeDto.last_name,
        device_id: updateEmployeeDto.device_id,
      };
      const result = await this.employeeRepository.update(
        employee_id,
        allowedUpdates,
      );
      if (result.affected === 0) {
        return {
          success: false,
          message: 'Employee not found',
        };
      }
      return {
        success: true,
        message: 'Employee updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateDisable(employee_id: string) {
    try {
      const result = await this.employeeRepository.update(
        { employee_id },
        {
          is_active: false,
          date_deactivated: new Date().toISOString(),
        },
      );
      if (result.affected === 0) {
        return {
          success: false,
          message: 'Employee not found',
        };
      }
      return {
        success: true,
        message: 'Employee disabled successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async remove(employee_id: string) {
    try {
      const result = await this.employeeRepository.delete(employee_id);
      if (result.affected === 0) {
        return {
          success: false,
          message: 'Employee not found',
        };
      }
      return {
        success: true,
        message: 'Employee deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
