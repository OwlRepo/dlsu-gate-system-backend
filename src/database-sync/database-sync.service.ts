import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncSchedule } from './entities/sync-schedule.entity';
import { ConfigService } from '@nestjs/config';
import { ScheduledSyncDto } from './dto/scheduled-sync.dto';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { v4 as uuid } from 'uuid';
import * as sql from 'mssql';
import * as fs from 'fs';
import axios from 'axios';
import { createObjectCsvWriter } from 'csv-writer';
import * as path from 'path';
import FormData from 'form-data';
import { Student } from '../students/entities/student.entity';

@Injectable()
export class DatabaseSyncService {
  private readonly logger = new Logger(DatabaseSyncService.name);
  private readonly activeJobs = new Map<string, boolean>();
  private sqlConfig: sql.config;
  private apiBaseUrl: string;
  private apiCredentials: { login_id: string; password: string };

  constructor(
    @InjectRepository(SyncSchedule)
    private syncScheduleRepository: Repository<SyncSchedule>,
    @InjectRepository(Student)
    private studentRepository: Repository<Student>,
    private configService: ConfigService,
    private schedulerRegistry: SchedulerRegistry,
  ) {
    this.initializeSchedules();

    this.sqlConfig = {
      user: this.configService.get('SOURCE_DB_USERNAME'),
      password: this.configService.get('SOURCE_DB_PASSWORD'),
      database: this.configService.get('SOURCE_DB_NAME'),
      server: this.configService.get('SOURCE_DB_HOST'),
      port: parseInt(this.configService.get('SOURCE_DB_PORT')),
      options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectTimeout: 30000,
      },
    };

    this.apiBaseUrl = this.configService.get('BIOSTAR_API_BASE_URL');
    this.apiCredentials = {
      login_id: this.configService.get('BIOSTAR_API_LOGIN_ID'),
      password: this.configService.get('BIOSTAR_API_PASSWORD'),
    };
  }

  private async initializeSchedules() {
    const defaultSchedules = [
      { scheduleNumber: 1, time: '09:00' },
      { scheduleNumber: 2, time: '21:00' },
    ];

    for (const schedule of defaultSchedules) {
      const existing = await this.syncScheduleRepository.findOne({
        where: { scheduleNumber: schedule.scheduleNumber },
      });

      if (!existing) {
        const cronExpression = this.convertMilitaryTimeToCron(schedule.time);
        const newSchedule = this.syncScheduleRepository.create({
          ...schedule,
          cronExpression,
        });
        await this.syncScheduleRepository.save(newSchedule);
        this.addCronJob(`sync-${schedule.scheduleNumber}`, cronExpression);
      } else {
        this.addCronJob(
          `sync-${schedule.scheduleNumber}`,
          existing.cronExpression,
        );
      }
    }
  }

  private addCronJob(name: string, cronExpression: string) {
    const job = new CronJob(cronExpression, () => {
      this.executeDatabaseSync(name);
    });

    this.schedulerRegistry.addCronJob(name, job);
    job.start();
  }

  private convertMilitaryTimeToCron(time: string): string {
    const [hours, minutes] = time.split(':');
    return `${minutes} ${hours} * * *`;
  }

  async updateSchedule(scheduleNumber: number, time: string) {
    const existingSchedule = await this.syncScheduleRepository.findOne({
      where: { scheduleNumber },
    });

    if (!existingSchedule) {
      throw new BadRequestException(
        `Schedule ${scheduleNumber} does not exist`,
      );
    }

    if (scheduleNumber !== 1 && scheduleNumber !== 2) {
      throw new BadRequestException('Schedule number must be 1 or 2');
    }

    const cronExpression = this.convertMilitaryTimeToCron(time);
    const jobName = `sync-${scheduleNumber}`;

    // Update database
    existingSchedule.time = time;
    existingSchedule.cronExpression = cronExpression;
    await this.syncScheduleRepository.save(existingSchedule);

    // Update cron job
    const existingJob = this.schedulerRegistry.getCronJob(jobName);
    if (existingJob) {
      existingJob.stop();
      this.schedulerRegistry.deleteCronJob(jobName);
    }
    this.addCronJob(jobName, cronExpression);

    return {
      message: 'Schedule updated successfully',
      scheduleNumber,
      time,
    };
  }

  async getAllSchedules(): Promise<ScheduledSyncDto[]> {
    const schedules = await this.syncScheduleRepository.find();
    return schedules.map((schedule) => {
      const job = this.schedulerRegistry.getCronJob(
        `sync-${schedule.scheduleNumber}`,
      );
      return {
        scheduleNumber: schedule.scheduleNumber,
        time: schedule.time,
        isActive: job?.running ?? false,
        lastSyncTime: schedule.lastSyncTime || null,
        nextRun: job?.nextDate().toJSDate() || null,
      };
    });
  }

  private async getApiToken(): Promise<{ token: string; sessionId: string }> {
    try {
      const response = await axios.post(
        `${this.apiBaseUrl}/api/login`,
        {
          User: this.apiCredentials,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      // Get both token and session ID
      const sessionId = response.headers['bs-session-id'];
      const token = response.data.token;

      if (!sessionId) {
        throw new Error('No session ID received from BIOSTAR API');
      }

      return { token, sessionId };
    } catch (error) {
      this.logger.error('Failed to get API token:', error);
      throw new Error('Failed to authenticate with the BIOSTAR API');
    }
  }

  private async checkTableExists(pool: sql.ConnectionPool): Promise<boolean> {
    try {
      const result = await pool.request().query(`
          SELECT OBJECT_ID('Students') as TableID;
        `);
      return result.recordset[0].TableID !== null;
    } catch (error) {
      this.logger.error('Error checking table existence:', error);
      return false;
    }
  }

  private async createTableIfNotExists(
    pool: sql.ConnectionPool,
  ): Promise<void> {
    const tableExists = await this.checkTableExists(pool);
    if (!tableExists) {
      await pool.request().query(`
        CREATE TABLE Students (
          ID INT PRIMARY KEY IDENTITY(1,1),
          -- Add your other columns here
          isArchived BIT DEFAULT 0,
          CreatedAt DATETIME DEFAULT GETDATE(),
          UpdatedAt DATETIME DEFAULT GETDATE()
        );
      `);
      this.logger.log('Students table created successfully');
    }
  }

  private async executeDatabaseSync(jobName: string) {
    if (this.activeJobs.get(jobName)) {
      this.logger.warn(`Sync ${jobName} is already running`);
      return;
    }

    let pool: sql.ConnectionPool | null = null;
    let csvFilePath: string | null = null;

    try {
      this.activeJobs.set(jobName, true);
      this.logger.log(`Starting database sync for ${jobName}`);

      // 1. Connect to SQL Server and ensure table exists
      pool = await sql.connect(this.sqlConfig);
      await this.createTableIfNotExists(pool);

      // 2. Fetch data with pagination for large datasets
      const batchSize = 1000;
      let offset = 0;
      let allRecords = [];

      while (true) {
        const result = await pool.request().query(`
            SELECT * FROM Students 
            WHERE isArchived = 0 
            ORDER BY ID 
            OFFSET ${offset} ROWS 
            FETCH NEXT ${batchSize} ROWS ONLY
          `);

        if (result.recordset.length === 0) break;
        allRecords = allRecords.concat(result.recordset);
        offset += batchSize;
      }

      if (allRecords.length === 0) {
        this.logger.log('No non-archived records to sync');
        return;
      }

      // 3. Sync data to PostgreSQL
      this.logger.log('Syncing data to PostgreSQL database');
      for (const record of allRecords) {
        // Find existing student or create new one
        let student = await this.studentRepository.findOne({
          where: {
            ID_Number: record.ID_Number, // Using ID_Number as unique identifier
          },
        });

        if (!student) {
          student = this.studentRepository.create();
        }

        // Map SQL Server fields to PostgreSQL fields
        Object.assign(student, {
          ID_Number: record.ID_Number,
          Name: record.Name,
          Lived_Name: record.Lived_Name,
          Remarks: record.Remarks,
          Photo: record.Photo,
          Campus_Entry: record.Campus_Entry,
          Unique_ID: record.Unique_ID,
          isArchived: record.isArchived,
          updatedAt: new Date(),
        });

        await this.studentRepository.save(student);
      }
      this.logger.log(`Synced ${allRecords.length} records to PostgreSQL`);

      // 4. Convert to CSV
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }

      csvFilePath = path.join(tempDir, `sync_${Date.now()}.csv`);
      const csvWriter = createObjectCsvWriter({
        path: csvFilePath,
        header: Object.keys(allRecords[0]).map((id) => ({
          id,
          title: id,
        })),
      });

      await csvWriter.writeRecords(allRecords);
      this.logger.log(`CSV file created at ${csvFilePath}`);

      // 5. Upload to API with retries
      let retries = 3;
      while (retries > 0) {
        try {
          const { token, sessionId } = await this.getApiToken();
          const formData = new FormData();
          const fileStream = fs.createReadStream(csvFilePath);
          formData.append('file', fileStream, {
            filename: path.basename(csvFilePath),
            contentType: 'text/csv',
          });

          await axios.post(
            `${this.apiBaseUrl}/api/users/csv_import`,
            formData,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'bs-session-id': sessionId,
                'Content-Type': 'multipart/form-data',
              },
              timeout: 30000,
            },
          );

          this.logger.log('CSV file uploaded successfully');
          break;
        } catch (error) {
          retries--;
          if (retries === 0) throw error;
          this.logger.warn(
            `Upload failed, retrying... (${retries} attempts left)`,
          );
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }

      // Update lastSyncTime if it's a scheduled job
      const scheduleNumber = parseInt(jobName.replace('sync-', ''));
      if (!isNaN(scheduleNumber)) {
        const schedule = await this.syncScheduleRepository.findOne({
          where: { scheduleNumber },
        });
        if (schedule) {
          schedule.lastSyncTime = new Date();
          await this.syncScheduleRepository.save(schedule);
          this.logger.log(
            `Updated last sync time for schedule ${scheduleNumber}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Sync failed for ${jobName}:`, error);
      throw error;
    } finally {
      // Cleanup
      if (csvFilePath && fs.existsSync(csvFilePath)) {
        fs.unlinkSync(csvFilePath);
        this.logger.log('Temporary CSV file cleaned up');
      }
      if (pool) {
        await pool.close();
        this.logger.log('Database connection closed');
      }
      this.activeJobs.set(jobName, false);
    }
  }

  async triggerManualSync() {
    const queueId = uuid();
    const jobName = `manual-${queueId}`;
    await this.executeDatabaseSync(jobName);
    return {
      message: 'Manual sync completed',
      queueId,
    };
  }

  async testConnection() {
    let pool: sql.ConnectionPool | null = null;
    try {
      this.logger.log('Testing SQL Server connection...');
      pool = await sql.connect(this.sqlConfig);

      // Test query to check if we can access the Students table
      const result = await pool.request().query(`
        SELECT TOP 1 * FROM Students
      `);

      this.logger.log('Connection successful');
      this.logger.log('Sample data:', result.recordset[0]);

      return {
        success: true,
        message: 'Connection successful',
        sampleData: result.recordset[0],
      };
    } catch (error) {
      this.logger.error('Connection test failed:', error);
      throw new BadRequestException(`Connection failed: ${error.message}`);
    } finally {
      if (pool) {
        await pool.close();
        this.logger.log('Connection closed');
      }
    }
  }
}
