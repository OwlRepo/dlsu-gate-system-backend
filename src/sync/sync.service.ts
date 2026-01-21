import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../students/entities/student.entity';

@Injectable()
export class SyncService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
  ) {}

  async getAllStudents(): Promise<{
    students: Student[];
  }> {
    try {
      const students = await this.studentRepository.find({
        where: { isArchived: false },
      });

      return { students };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
