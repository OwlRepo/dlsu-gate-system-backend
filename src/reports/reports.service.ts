import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like } from 'typeorm';
import { Report } from './entities/report.entity';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createObjectCsvWriter } from 'csv-writer';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
  ) {}

  async create(createReportDto: any) {
    const report = this.reportRepository.create({
      ...createReportDto,
      datetime: new Date(createReportDto.datetime),
    });
    return await this.reportRepository.save(report);
  }

  async findAll() {
    return await this.reportRepository.find();
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
    const fileName = `report-${uuidv4()}.csv`;
    const filePath = path.join('temp', fileName);

    // Ensure temp directory exists
    if (!fs.existsSync('temp')) {
      fs.mkdirSync('temp');
    }

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'datetime', title: 'Date' },
        { id: 'type', title: 'Type' },
        { id: 'name', title: 'Name' },
        { id: 'user_id', title: 'User ID' },
        { id: 'status', title: 'Status' },
        { id: 'remarks', title: 'Remarks' },
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
