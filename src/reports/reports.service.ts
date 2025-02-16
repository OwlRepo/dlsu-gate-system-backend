import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like } from 'typeorm';
import { Report } from './entities/report.entity';
import * as fs from 'fs';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { CreateReportDto } from './dto/create-report.dto';

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

  async findAll() {
    return await this.reportRepository.find({
      select: [
        'id',
        'datetime',
        'type',
        'user_id',
        'name',
        'remarks',
        'status',
        'created_at',
      ],
    });
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

  async generateCSVReport(): Promise<{ filePath: string; fileName: string }> {
    const reports = await this.reportRepository.find();
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
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
        { id: 'datetime', title: 'datetime' },
        { id: 'type', title: 'type' },
        { id: 'name', title: 'name' },
        { id: 'user_id', title: 'user_id' },
        { id: 'status', title: 'status' },
        { id: 'remarks', title: 'remarks' },
      ],
    });

    await csvWriter.writeRecords(
      reports.map((report) => ({
        ...report,
        datetime: report.datetime.toISOString(),
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
