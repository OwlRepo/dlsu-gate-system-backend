import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like } from 'typeorm';
import { Report } from './entities/report.entity';
import * as fs from 'fs';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { CreateReportDto } from './dto/create-report.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
  ) {}

  async create(createReportDto: CreateReportDto) {
    const report = this.reportRepository.create({
      ...createReportDto,
      datetime: new Date(createReportDto.datetime),
    });
    return await this.reportRepository.save(report);
  }

  async findAll(query: PaginationQueryDto) {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.reportRepository.createQueryBuilder('report');

    if (search) {
      queryBuilder.where(
        '(report.name LIKE :search OR report.remarks LIKE :search OR report.type LIKE :search OR report.user_id LIKE :search)',
        { search: `%${search}%` },
      );
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

  async searchContains(searchString: string) {
    return await this.reportRepository.find({
      where: [
        { name: Like(`%${searchString}%`) },
        { remarks: Like(`%${searchString}%`) },
        { type: Like(`%${searchString}%`) },
      ],
    });
  }

  async findByDateRange(startDate: string, endDate: string) {
    return await this.reportRepository.find({
      where: {
        datetime: Between(new Date(startDate), new Date(endDate)),
      },
    });
  }

  async findByType(type: string) {
    if (type !== '0' && type !== '1') {
      throw new Error('Invalid type. Only types "0" and "1" are allowed.');
    }
    return await this.reportRepository.find({
      where: { type },
    });
  }

  async findByTypeAndDateRange(
    type: string,
    startDate: string,
    endDate: string,
  ) {
    return await this.reportRepository.find({
      where: {
        type,
        datetime: Between(new Date(startDate), new Date(endDate)),
      },
    });
  }

  async generateCSVReport(
    reports?: Report[],
  ): Promise<{ filePath: string; fileName: string }> {
    if (!reports) {
      reports = await this.reportRepository.find();
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `reports-${dateStr}.csv`;
    const uploadDir = path.join(process.cwd(), 'persistent_uploads', 'reports');
    const filePath = path.join(uploadDir, fileName);

    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'datetime', title: 'Date Time' },
        { id: 'type', title: 'Type' },
        { id: 'user_id', title: 'User ID' },
        { id: 'name', title: 'Name' },
        { id: 'remarks', title: 'Remarks' },
        { id: 'status', title: 'Status' },
        { id: 'created_at', title: 'Created At' },
      ],
    });

    await csvWriter.writeRecords(
      reports.map((report) => ({
        ...report,
        datetime: report.datetime.toISOString(),
        created_at: report.created_at.toISOString(),
      })),
    );

    return { filePath, fileName };
  }

  async cleanupFile(filePath: string) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
