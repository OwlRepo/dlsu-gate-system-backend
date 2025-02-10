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
import * as FormData from 'form-data';
import { Student } from '../students/entities/student.entity';
import * as https from 'https';

@Injectable()
export class DatabaseSyncService {
  private readonly logger = new Logger(DatabaseSyncService.name);
  private readonly activeJobs = new Map<string, boolean>();
  private readonly jobStartTimes = new Map<string, Date>();
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
      this.logger.log('Attempting to authenticate with BIOSTAR API...');
      const response = await axios.post(
        `${this.apiBaseUrl}/api/login`,
        {
          User: this.apiCredentials,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          httpsAgent: new https.Agent({
            rejectUnauthorized: false,
          }),
        },
      );

      const sessionId = response.headers['bs-session-id'];
      const token = response.data.token;

      if (!sessionId) {
        throw new BadRequestException({
          message: 'BIOSTAR API Authentication Failed',
          details: 'No session ID received from BIOSTAR API',
          step: 'authentication',
        });
      }

      this.logger.log('Successfully authenticated with BIOSTAR API');
      return { token, sessionId };
    } catch (error) {
      this.logger.error('BIOSTAR API Authentication Failed:', error);

      // Handle different types of errors
      if (axios.isAxiosError(error)) {
        throw new BadRequestException({
          message: 'BIOSTAR API Authentication Failed',
          details: error.response?.data || error.message,
          step: 'authentication',
          statusCode: error.response?.status || 500,
        });
      }

      throw new BadRequestException({
        message: 'BIOSTAR API Authentication Failed',
        details: 'Unable to connect to BIOSTAR API',
        step: 'authentication',
      });
    }
  }

  private async checkColumnExists(
    pool: sql.ConnectionPool,
    columnName: string,
  ): Promise<boolean> {
    try {
      const result = await pool.request().query(`
        SELECT COUNT(*) as count
        FROM sys.columns 
        WHERE object_id = OBJECT_ID('ISGATE_MASTER_VW')
        AND name = '${columnName}'
      `);
      return result.recordset[0].count > 0;
    } catch (error) {
      this.logger.error(
        `Error checking column existence for ${columnName}:`,
        error,
      );
      return false;
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
      this.jobStartTimes.set(jobName, new Date());
      this.logger.log(`Starting database sync for ${jobName}`);

      // 1. Connect to SQL Server
      pool = await sql.connect(this.sqlConfig);

      // 2. Check if isArchived column exists
      const hasIsArchivedColumn = await this.checkColumnExists(
        pool,
        'isArchived',
      );
      this.logger.log(
        `Table ${hasIsArchivedColumn ? 'has' : 'does not have'} isArchived column`,
      );

      // 3. Fetch data with pagination for large datasets
      const batchSize = 1000;
      let offset = 0;
      let allRecords = [];

      while (true) {
        // Modify query based on isArchived column existence
        const query = hasIsArchivedColumn
          ? `
            SELECT * FROM ISGATE_MASTER_VW 
            WHERE isArchived = 0 
            ORDER BY ID_Number 
            OFFSET ${offset} ROWS 
            FETCH NEXT ${batchSize} ROWS ONLY
          `
          : `
            SELECT * FROM ISGATE_MASTER_VW 
            ORDER BY ID_Number 
            OFFSET ${offset} ROWS 
            FETCH NEXT ${batchSize} ROWS ONLY
          `;

        const result = await pool.request().query(query);

        if (result.recordset.length === 0) break;
        allRecords = allRecords.concat(result.recordset);
        offset += batchSize;
      }

      if (allRecords.length === 0) {
        this.logger.log('No records to sync');
        return;
      }

      this.logger.log(`Found ${allRecords.length} records to sync`);

      // 4. Sync data to PostgreSQL
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

      // 5. Convert to CSV with specific format
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }

      csvFilePath = path.join(tempDir, `sync_${Date.now()}.csv`);
      const csvWriter = createObjectCsvWriter({
        path: csvFilePath,
        header: [
          { id: 'user_id', title: 'user_id' },
          { id: 'name', title: 'name' },
          { id: 'department', title: 'department' },
          { id: 'user_title', title: 'user_title' },
          { id: 'phone', title: 'phone' },
          { id: 'email', title: 'email' },
          { id: 'user_group', title: 'user_group' },
          { id: 'start_datetime', title: 'start_datetime' },
          { id: 'expiry_datetime', title: 'expiry_datetime' },
          { id: 'Lived Name', title: 'Lived Name' },
          { id: 'Remarks', title: 'Remarks' },
          { id: 'csn', title: 'csn' },
        ],
      });

      // Transform records to match format
      const formattedRecords = allRecords.map((record) => ({
        user_id: record.ID_Number,
        name: record.Name,
        department: '',
        user_title: '',
        phone: '',
        email: '',
        user_group: 'All Users',
        start_datetime: '2001-01-01 00:00:00',
        expiry_datetime: '2030-12-31 23:59:00',
        'Lived Name': record.Lived_Name || '',
        Remarks: record.Remarks || '',
        csn: 1539828941,
      }));

      await csvWriter.writeRecords(formattedRecords);
      this.logger.log(`CSV file created at ${csvFilePath}`);

      // 6. Upload to API with retries
      let retries = 3;
      while (retries > 0) {
        try {
          const { token, sessionId } = await this.getApiToken();
          const formData = new FormData();
          const fileStream = fs.createReadStream(csvFilePath);

          // First append the file
          formData.append('file', fileStream, {
            filename: path.basename(csvFilePath),
            contentType: 'text/csv',
          });

          // Then append the JSON as a separate part
          const csvOptions = {
            File: {
              url: '',
              fileName: path.basename(csvFilePath),
            },
            CsvOption: {
              columns: {
                total: 12,
                rows: [
                  'user_id',
                  'name',
                  'department',
                  'user_title',
                  'phone',
                  'email',
                  'user_group',
                  'start_datetime',
                  'expiry_datetime',
                  'Lived Name',
                  'Remarks',
                  'csn',
                ],
              },
              start_line: 1,
              import_option: 1,
            },
            Query: {
              headers: [],
              columns: [],
            },
          };

          formData.append('json', JSON.stringify(csvOptions), {
            contentType: 'application/json',
          });

          this.logger.log('Attempting CSV upload with payload:', {
            url: `${this.apiBaseUrl}/api/users/csv_import`,
            options: csvOptions,
            headers: {
              ...formData.getHeaders(),
              'bs-session-id': sessionId,
            },
            fileInfo: {
              name: path.basename(csvFilePath),
              size: fs.statSync(csvFilePath).size,
              preview: fs
                .readFileSync(csvFilePath, 'utf8')
                .split('\n')
                .slice(0, 3),
            },
          });

          await axios.post(
            `${this.apiBaseUrl}/api/users/csv_import`,
            formData,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'bs-session-id': sessionId,
                'Content-Type': formData.getHeaders()['Content-Type'],
              },
              maxBodyLength: Infinity,
              maxContentLength: Infinity,
              timeout: 30000,
              httpsAgent: new https.Agent({
                rejectUnauthorized: false,
              }),
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
      this.jobStartTimes.delete(jobName);
    }
  }

  async triggerManualSync() {
    const queueId = uuid();
    const jobName = `manual-${queueId}`;

    try {
      await this.executeDatabaseSync(jobName);
      return {
        success: true,
        message: 'Manual sync completed successfully',
        queueId,
      };
    } catch (error) {
      // Handle different types of errors
      if (error instanceof BadRequestException) {
        throw error; // Re-throw formatted errors
      }

      this.logger.error('Manual sync failed:', error);
      throw new BadRequestException({
        message: 'Manual Sync Failed',
        details: error.message,
        step: error.step || 'unknown',
        queueId,
      });
    }
  }

  async testConnection() {
    let pool: sql.ConnectionPool | null = null;
    try {
      this.logger.log('Testing SQL Server connection...');
      pool = await sql.connect(this.sqlConfig);

      // Check if isArchived column exists
      const hasIsArchivedColumn = await this.checkColumnExists(
        pool,
        'isArchived',
      );

      // Test query
      const query = hasIsArchivedColumn
        ? `SELECT TOP 1 * FROM ISGATE_MASTER_VW WHERE isArchived = 0 ORDER BY ID_Number`
        : `SELECT TOP 1 * FROM ISGATE_MASTER_VW ORDER BY ID_Number`;

      const result = await pool.request().query(query);

      this.logger.log('Connection successful');
      this.logger.log('Sample data:', result.recordset[0]);

      return {
        success: true,
        message: 'Connection successful',
        sampleData: result.recordset[0],
        tableInfo: {
          hasIsArchivedColumn,
          recordCount: result.recordset.length,
        },
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

  async getRunningSync() {
    const runningJobs = [];

    for (const [jobName, isActive] of this.activeJobs.entries()) {
      if (isActive) {
        runningJobs.push({
          jobName,
          startedAt: this.jobStartTimes.get(jobName),
          isManual: jobName.startsWith('manual-'),
        });
      }
    }

    return {
      runningJobs,
      count: runningJobs.length,
    };
  }
}
