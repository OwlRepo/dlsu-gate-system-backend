import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from './entities/student.entity';
import { StudentPaginationDto } from './dto/student-pagination.dto';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private studentRepository: Repository<Student>,
  ) {}

  async findAll(query: StudentPaginationDto) {
    const { page = 1, limit = 10, search, isArchived } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.studentRepository
      .createQueryBuilder('student')
      .select([
        'student.id',
        'student.ID_Number',
        'student.Name',
        'student.Lived_Name',
        'student.Remarks',
        'student.Campus_Entry',
        'student.Unique_ID',
        'student.isArchived',
        'student.createdAt',
        'student.updatedAt',
      ]);

    if (search) {
      queryBuilder.where(
        '(student.ID_Number LIKE :search OR student.Name LIKE :search OR student.Remarks LIKE :search OR student.Campus_Entry LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (isArchived !== undefined) {
      queryBuilder.andWhere('student.isArchived = :isArchived', { isArchived });
    }

    const [items, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
