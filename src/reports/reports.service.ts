import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, FindManyOptions } from 'typeorm';
import { Report } from './entities/report.entity';
import * as fs from 'fs';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { CreateReportDto } from './dto/create-report.dto';
import { EnhancedReportQueryDto } from './dto/enhanced-report-query.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
  ) {}

  async create(createReportDto: CreateReportDto) {
    const report = this.reportRepository.create({
      ...createReportDto,
      datetime: new Date(createReportDto.datetime),
    });
    return await this.reportRepository.save(report);
  }

  async findAll(query: EnhancedReportQueryDto) {
    const {
      page = 1,
      limit = 10,
      type,
      startDate,
      endDate,
      searchTerm,
    } = query;

    const queryBuilder = this.reportRepository.createQueryBuilder('report');

    // Apply type filter
    if (type) {
      queryBuilder.andWhere('report.type = :type', { type });
    }

    // Apply date range filter
    if (startDate && endDate) {
      queryBuilder.andWhere('report.datetime BETWEEN :startDate AND :endDate', {
        startDate: `${startDate} 00:00:00`,
        endDate: `${endDate} 23:59:59`,
      });
    }

    // Apply search filter
    if (searchTerm) {
      queryBuilder.andWhere(
        '(LOWER(report.name) LIKE LOWER(:search) OR LOWER(report.remarks) LIKE LOWER(:search))',
        { search: `%${searchTerm}%` },
      );
    }

    // Add pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      total,
      page: Number(page),
      limit: Number(limit),
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
    if (type !== '1' && type !== '2') {
      throw new Error(
        'Invalid type. Only types "1" (entry) and "2" (out) are allowed.',
      );
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

  async find(options: FindManyOptions<Report>): Promise<Report[]> {
    return await this.reportRepository.find(options);
  }
}
