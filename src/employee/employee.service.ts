/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Employee } from './entities/employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
  ) {}

  async create(createEmployeeDto: CreateEmployeeDto) {
    try {
      // Check if deviceId array is empty
      if (
        !createEmployeeDto.deviceId ||
        createEmployeeDto.deviceId.length === 0
      ) {
        return {
          success: false,
          message: 'At least one device ID is required',
        };
      }

      // Check for duplicate device IDs
      const uniqueDeviceIds = new Set(createEmployeeDto.deviceId);
      if (uniqueDeviceIds.size !== createEmployeeDto.deviceId.length) {
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
      const generatedEmployeeId = `EMP${Math.floor(Math.random() * 10000)}`;

      // Check for existing employeeId
      const existingEmployeeId = await this.employeeRepository.findOne({
        where: { employeeId: generatedEmployeeId },
      });

      if (existingEmployeeId) {
        return {
          success: false,
          message: 'Generated Employee ID already exists. Please try again.',
        };
      }

      // Generate random data for remaining fields
      const employee = await this.employeeRepository.create({
        ...createEmployeeDto,
        employeeId: generatedEmployeeId,
        isActive: true,
        dateCreated: now.toISOString(),
        dateActivated: now.toISOString(),
        dateDeactivated: null,
      });

      // Save to database
      const savedEmployee = await this.employeeRepository.save(employee);
      return {
        success: true,
        data: savedEmployee,
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
        where: [{ employeeId: idOrUsername }, { username: idOrUsername }],
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

  async findByDeviceId(deviceId: string) {
    try {
      const employees = await this.employeeRepository.find();
      const filteredEmployees = employees.filter(
        (employee) => employee.deviceId && employee.deviceId.includes(deviceId),
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
        where: { dateCreated: Between(startDate, endDate) },
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

  async update(employeeId: string, updateEmployeeDto: UpdateEmployeeDto) {
    try {
      const allowedUpdates = {
        username: updateEmployeeDto.username,
        firstName: updateEmployeeDto.firstName,
        lastName: updateEmployeeDto.lastName,
        deviceId: updateEmployeeDto.deviceId,
      };
      const result = await this.employeeRepository.update(
        employeeId,
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

  async updateDisable(employeeId: string) {
    try {
      const result = await this.employeeRepository.update(
        { employeeId },
        {
          isActive: false,
          dateDeactivated: new Date().toISOString(),
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

  async remove(employeeId: string) {
    try {
      const result = await this.employeeRepository.delete(employeeId);
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
