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
import { Student } from '../students/entities/student.entity';
import * as https from 'https';
import * as FormData from 'form-data';
import { In } from 'typeorm';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import * as Table from 'cli-table3';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class DatabaseSyncService {
  private readonly logger = new Logger(DatabaseSyncService.name);
  private readonly activeJobs = new Map<string, boolean>();
  private readonly jobStartTimes = new Map<string, Date>();
  private sqlConfig: sql.config;
  private apiBaseUrl: string;
  private apiCredentials: { login_id: string; password: string };
  private readonly logDir = path.join(process.cwd(), 'logs', 'skipped-records');
  private readonly syncedDir = path.join(
    process.cwd(),
    'logs',
    'synced-records',
  );
  private readonly syncedJsonDir = path.join(
    process.cwd(),
    'logs',
    'synced-records',
    'json',
  );
  private readonly syncedCsvDir = path.join(
    process.cwd(),
    'logs',
    'synced-records',
    'csv',
  );

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
        encrypt: false,
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

    this.ensureLogDirectory();
  }

  private ensureLogDirectory() {
    const directories = [
      this.logDir,
      this.syncedDir,
      this.syncedJsonDir,
      this.syncedCsvDir,
    ];

    directories.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Cleanup logs older than 1 month
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    directories.forEach((dir) => {
      fs.readdirSync(dir).forEach((file) => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        if (stats.mtime < oneMonthAgo) {
          fs.unlinkSync(filePath);
        }
      });
    });
  }

  private removeSpecialChars(str: string): string {
    return str.replace(/[^a-zA-Z0-9\s]/g, '');
  }

  private sanitizeUserId(userId: string): string {
    // Remove spaces from the userId first
    const cleanUserId = userId.replace(/\s/g, '');
    // Convert hex to decimal if userId is a valid hex number
    if (/^[0-9A-Fa-f]+$/.test(cleanUserId)) {
      const decimal = parseInt(cleanUserId, 16);
      if (!isNaN(decimal)) {
        userId = decimal.toString();
      }
    }
    return userId;
  }

  private async initializeSchedules() {
    const defaultSchedules = [
      { scheduleNumber: 1, time: '09:00' },
      { scheduleNumber: 2, time: '21:00' },
    ];

    for (const schedule of defaultSchedules) {
      try {
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
      } catch (error) {
        this.logger.error(
          `Failed to initialize schedule ${schedule.scheduleNumber}:`,
          error,
        );
        // Continue with next schedule even if one fails
        continue;
      }
    }
  }

  private addCronJob(name: string, cronExpression: string) {
    const job = new CronJob(
      cronExpression,
      () => {
        this.executeDatabaseSync(name);
      },
      null,
      true,
      'Asia/Manila', // Set timezone to Philippine Time
    );

    this.schedulerRegistry.addCronJob(name, job);
    job.start();
  }

  private convertMilitaryTimeToCron(time: string): string {
    const [hours, minutes] = time.split(':');
    // Convert to UTC time (Philippine Time is UTC+8)
    const utcHours = (parseInt(hours) - 8 + 24) % 24; // Add 24 before modulo to handle negative hours
    return `${minutes} ${utcHours} * * *`;
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
      timezone: 'Asia/Manila',
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
        lastSyncTime: schedule.lastSyncTime
          ? dayjs(schedule.lastSyncTime).tz('Asia/Manila').toDate()
          : null,
        nextRun: job?.nextDate()?.toJSDate()
          ? dayjs(job.nextDate().toJSDate()).tz('Asia/Manila').toDate()
          : null,
        timezone: 'Asia/Manila',
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
          biostarMessage: response.data?.Response?.message,
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
          biostarMessage: error.response?.data?.Response?.message,
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

  private async convertPhotoToBase64(photoData: any): Promise<string | null> {
    try {
      let imageBuffer: Buffer;
      const defaultImagePath = path.join(process.cwd(), 'dlsu.png');

      // Check if default image exists
      if (!fs.existsSync(defaultImagePath)) {
        this.logger.warn(
          'Default image (dlsu.png) not found in root directory',
        );
        return null;
      }

      try {
        // Add handling for hex string format starting with "0x"
        if (typeof photoData === 'string' && photoData.startsWith('0x')) {
          // Remove '0x' prefix and convert hex string to buffer
          const hexData = photoData.slice(2); // Remove '0x' prefix
          imageBuffer = Buffer.from(hexData, 'hex');
        } else if (typeof photoData === 'string' && photoData.length > 0) {
          // Handle string path input
          if (fs.existsSync(photoData)) {
            imageBuffer = fs.readFileSync(photoData);
          } else {
            this.logger.warn(
              `Photo file not found at path: ${photoData}, using default image`,
            );
            imageBuffer = fs.readFileSync(defaultImagePath);
          }
        } else if (photoData instanceof Buffer) {
          // Handle Buffer input
          imageBuffer = photoData;
        } else if (
          photoData instanceof Blob ||
          (typeof Blob !== 'undefined' && photoData instanceof Blob)
        ) {
          // Handle Blob input
          try {
            const arrayBuffer = await photoData.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuffer);
          } catch (blobError) {
            this.logger.warn(
              `Failed to convert Blob to Buffer: ${blobError.message}, using default image`,
            );
            imageBuffer = fs.readFileSync(defaultImagePath);
          }
        } else if (
          photoData &&
          typeof photoData === 'object' &&
          'data' in photoData
        ) {
          // Handle potential database BLOB object
          try {
            if (Buffer.isBuffer(photoData.data)) {
              imageBuffer = photoData.data;
            } else if (Array.isArray(photoData.data)) {
              imageBuffer = Buffer.from(photoData.data);
            } else {
              throw new Error('Invalid BLOB data format');
            }
          } catch (blobError) {
            this.logger.warn(
              `Failed to process BLOB data: ${blobError.message}, using default image`,
            );
            imageBuffer = fs.readFileSync(defaultImagePath);
          }
        } else {
          this.logger.debug(
            `No valid photo data provided (type: ${typeof photoData}), using default image`,
          );
          imageBuffer = fs.readFileSync(defaultImagePath);
        }

        // Validate image buffer
        if (!imageBuffer || imageBuffer.length === 0) {
          this.logger.warn('Empty image buffer detected, using default image');
          imageBuffer = fs.readFileSync(defaultImagePath);
        }

        // Additional validation for corrupted images
        if (imageBuffer.length < 100) {
          this.logger.warn(
            'Suspiciously small image detected, using default image',
          );
          imageBuffer = fs.readFileSync(defaultImagePath);
        }

        const base64String = imageBuffer.toString('base64');
        return base64String;
      } catch (conversionError) {
        this.logger.error('Error during image conversion:', {
          error: conversionError.message,
          photoDataType: typeof photoData,
          isBuffer: Buffer.isBuffer(photoData),
          isBlob: photoData instanceof Blob,
          hasData: photoData && 'data' in photoData,
        });

        // Fallback to default image
        this.logger.warn('Using default image due to conversion error');
        const defaultBuffer = fs.readFileSync(defaultImagePath);
        return defaultBuffer.toString('base64');
      }
    } catch (error) {
      this.logger.error('Critical error in convertPhotoToBase64:', {
        error: error.message,
        stack: error.stack,
        photoDataType: typeof photoData,
      });
      return null;
    }
  }

  private async logSyncedRecords(formattedRecords: any[], jobName: string) {
    // Format the date as YYYY_MM_DD
    const dateString = new Date()
      .toISOString()
      .split('T')[0]
      .replace(/-/g, '_');

    // Get sync type from jobName (e.g., 'sync-1' -> 'sync1', 'manual-uuid' -> 'manual')
    const syncType = jobName.startsWith('manual-')
      ? 'manual'
      : jobName.replace('-', '');

    // Prepare the synced records data
    const syncedData = formattedRecords.map((record) => ({
      user_id: record.user_id,
      name: record.name,
      lived_name: record['Lived Name'],
      remarks: record.Remarks,
      campus_entry: record.original_campus_entry,
      expiry_datetime: record.expiry_datetime,
      sync_timestamp: new Date().toISOString(),
    }));

    // Save JSON format
    const jsonFilePath = path.join(
      this.syncedJsonDir,
      `synced_${syncType}_${dateString}.json`,
    );
    fs.writeFileSync(jsonFilePath, JSON.stringify(syncedData, null, 2));

    // Save CSV format
    const csvFilePath = path.join(
      this.syncedCsvDir,
      `synced_${syncType}_${dateString}.csv`,
    );
    const csvWriter = createObjectCsvWriter({
      path: csvFilePath,
      header: [
        { id: 'user_id', title: 'User ID' },
        { id: 'name', title: 'Name' },
        { id: 'lived_name', title: 'Lived Name' },
        { id: 'remarks', title: 'Remarks' },
        { id: 'campus_entry', title: 'Campus Entry' },
        { id: 'expiry_datetime', title: 'Expiry DateTime' },
        { id: 'sync_timestamp', title: 'Sync Timestamp' },
      ],
    });

    await csvWriter.writeRecords(syncedData);

    this.logger.log(`Saved ${syncedData.length} synced records to:`);
    this.logger.log(`- JSON: ${jsonFilePath}`);
    this.logger.log(`- CSV: ${csvFilePath}`);
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

        // Convert photos to base64 before adding to allRecords
        const recordsWithBase64Photos = await Promise.all(
          result.recordset.map(async (record) => ({
            ...record,
            Photo: await this.convertPhotoToBase64(record.Photo),
          })),
        );

        allRecords = allRecords.concat(recordsWithBase64Photos);
        offset += batchSize;
      }

      // Early return if no records found
      if (allRecords.length === 0) {
        this.logger.log('No records found in SQL Server to sync');

        // Update lastSyncTime even when no records found
        const scheduleNumber = parseInt(jobName.replace('sync-', ''));
        if (!isNaN(scheduleNumber)) {
          const schedule = await this.syncScheduleRepository.findOne({
            where: { scheduleNumber },
          });
          if (schedule) {
            schedule.lastSyncTime = new Date();
            await this.syncScheduleRepository.save(schedule);
            this.logger.log(
              `Updated last sync time for schedule ${scheduleNumber} (no records found)`,
            );
          }
        }

        return {
          success: true,
          message: 'Sync completed - no records found to process',
          recordsProcessed: 0,
        };
      }

      this.logger.log(`Found ${allRecords.length} records to sync`);

      // 4. Sync data to PostgreSQL
      this.logger.log('Syncing data to PostgreSQL database');

      // STEP 1: Get all existing students from database in one query
      // - More efficient than checking one by one
      // - Creates a baseline of what's already in our database
      const existingStudents = await this.studentRepository.find({
        where: { ID_Number: In(allRecords.map((r) => r.ID_Number)) },
      });

      // STEP 2: Create a quick lookup map using ID_Number
      // - Makes it fast to check if a student exists
      // - Avoids looping through array each time
      const existingMap = new Map(
        existingStudents.map((s) => [s.ID_Number, s]),
      );

      // STEP 3: Prepare lists for bulk operations
      const toCreate = []; // Will hold new students
      const toUpdate = []; // Will hold students that need updates

      // STEP 4: Sort through all records
      for (const record of allRecords) {
        // Prepare the data we want to save
        const data = {
          ID_Number: record.ID_Number,
          Name: record.Name,
          Lived_Name: record.Lived_Name,
          Remarks: record.Remarks,
          Photo: record.Photo,
          Campus_Entry: record.Campus_Entry,
          Unique_ID: record.Unique_ID,
          isArchived: record.isArchived,
          updatedAt: new Date(),
        };

        // Check if student already exists
        const existing = existingMap.get(record.ID_Number);

        if (!existing) {
          // CASE 1: New student - add to creation list
          toCreate.push(data);
        } else if (
          // CASE 2: Existing student - check if anything changed
          existing.Name !== record.Name ||
          existing.Lived_Name !== record.Lived_Name ||
          existing.Remarks !== record.Remarks ||
          existing.Photo !== record.Photo ||
          existing.Campus_Entry !== record.Campus_Entry ||
          existing.Unique_ID !== record.Unique_ID ||
          existing.isArchived !== record.isArchived
        ) {
          // Something changed - add to update list
          toUpdate.push({ ...data, id: existing.id });
        }
        // CASE 3: No changes - do nothing (skip)
      }

      // STEP 5: Perform bulk operations
      // Create all new records at once
      if (toCreate.length) {
        await this.studentRepository.insert(toCreate);
      }

      // Update all changed records at once
      if (toUpdate.length) {
        await this.studentRepository.save(toUpdate);
      }

      // STEP 6: Log the results
      this.logger.log(
        `Synced ${toCreate.length + toUpdate.length} records (${
          allRecords.length - (toCreate.length + toUpdate.length)
        } unchanged)`,
      );

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
          { id: 'lived_name', title: 'Lived Name' },
          { id: 'remarks', title: 'Remarks' },
          { id: 'csn', title: 'csn' },
          { id: 'photo', title: 'photo' },
          { id: 'face_image_file1', title: 'face_image_file1' },
          { id: 'face_image_file2', title: 'face_image_file2' },
          { id: 'start_datetime', title: 'start_datetime' },
          { id: 'expiry_datetime', title: 'expiry_datetime' },
          { id: 'original_campus_entry', title: 'original_campus_entry' },
        ],
      });

      // Transform records to match format
      const skippedRecords = [];

      const currentDate = dayjs().utc();
      const startDate = currentDate
        .subtract(10, 'year')
        .format('YYYYMMDD HH:mm:ss.SSS');

      // Calculate expiry dates
      const startDateObj = dayjs().utc().subtract(10, 'year'); // For start date
      const expiryDateEnabled = startDateObj
        .add(dayjs().year() - startDateObj.year() + 10, 'year') // Add years from current year + 10
        .format('YYYYMMDD HH:mm:ss.SSS');
      const expiryDateDisabled = currentDate // Use current date instead of start date
        .subtract(1, 'month') // Subtract 1 month from current date
        .format('YYYYMMDD HH:mm:ss.SSS');

      const formattedRecords = (
        await Promise.all(
          allRecords.map(async (record) => {
            const userId = this.sanitizeUserId(
              record.Unique_ID !== null && record.Unique_ID !== undefined
                ? record.Unique_ID?.toString()?.trim()
                : record.ID_Number?.toString()?.trim() || '',
            );
            const name = this.removeSpecialChars(record.Name?.trim() || '');
            const livedName = record.Lived_Name?.trim() || '';
            const remarks = record.Remarks?.trim() || '';

            // Validate all required fields
            const validationErrors = [];

            if (!userId || userId.length > 11) {
              validationErrors.push(!userId ? 'Empty ID' : 'ID too long');
            }

            if (!name) {
              validationErrors.push('Empty name');
            }

            if (name.length > 48) {
              validationErrors.push('Name exceeds 48 characters');
            }

            if (livedName.length > 48) {
              validationErrors.push('Lived name exceeds 48 characters');
            }

            if (remarks.length > 48) {
              validationErrors.push('Remarks exceeds 48 characters');
            }

            if (validationErrors.length > 0) {
              skippedRecords.push({
                ID_Number: record.ID_Number,
                userId,
                name,
                livedName,
                remarks,
                length: userId.length,
                reasons: validationErrors,
                timestamp: new Date().toISOString(),
              });
              this.logger.warn(
                `Skipping record with validation errors - ID: ${record.ID_Number}, Errors: ${validationErrors.join(', ')}`,
              );
              return null;
            }

            return {
              user_id: record.ID_Number,
              name: name,
              department: 'DLSU',
              user_title: 'Student',
              phone: '',
              email: '',
              user_group: 'All Users',
              'Lived Name': livedName,
              Remarks: remarks,
              csn: userId,
              photo: await this.convertPhotoToBase64(record.Photo),
              face_image_file1: await this.convertPhotoToBase64(record.Photo),
              face_image_file2: await this.convertPhotoToBase64(record.Photo),
              start_datetime: startDate,
              expiry_datetime:
                record.Campus_Entry.toString().toUpperCase() === 'N'
                  ? expiryDateDisabled
                  : expiryDateEnabled,
              original_campus_entry: record.Campus_Entry,
            };
          }),
        )
      ).filter((record) => record !== null);

      // Add logging for disabled accounts
      const disabledCount = formattedRecords.filter(
        (r) => r.original_campus_entry.toString().toUpperCase() === 'N',
      ).length;
      this.logger.log(
        `${disabledCount} student accounts are disabled (Campus Entry: N)`,
      );

      // Add after formattedRecords is created and before the disabled count logging
      const enabledCount = formattedRecords.filter(
        (r) => r.original_campus_entry.toString().toUpperCase() === 'Y',
      ).length;
      this.logger.log(
        `
Data Summary:
-------------
Total Records: ${formattedRecords.length}
Enabled Accounts (Campus Entry: Y): ${enabledCount}
Disabled Accounts (Campus Entry: N): ${disabledCount}
-------------`,
      );

      const tableConfig = {
        head: [
          'user_id (varchar)',
          'name (varchar)',
          'department (varc',
          'user_title (varc',
          'phone (varchar)',
          'email (varchar)',
          'user_group (',
          'start_datetime (datet',
          'expiry_datetime (datet',
          'Lived Name (varchar)',
          'Remarks (varchar)',
          'csn (varchar)',
          'photo (varchar)',
          'face_image_file1 (varchar)',
          'face_image_file2 (varchar)',
        ],
        chars: {
          top: '─',
          'top-mid': '┬',
          'top-left': '┌',
          'top-right': '┐',
          bottom: '─',
          'bottom-mid': '┴',
          'bottom-left': '└',
          'bottom-right': '┘',
          left: '│',
          'left-mid': '├',
          mid: '─',
          'mid-mid': '┼',
          right: '│',
          'right-mid': '┤',
          middle: '│',
        },
        colWidths: [15, 20, 15, 15, 14, 14, 12, 18, 18, 17, 16, 12, 15, 20, 20],
      };

      const table = new Table({
        ...tableConfig,
        style: {
          head: ['green'],
          border: ['green'],
        },
      });

      // Add all records to the table
      formattedRecords.slice(0, 100).forEach((r) => {
        table.push([
          r.user_id,
          r.name,
          r.department,
          r.user_title,
          r.phone || '',
          r.email || '',
          r.user_group,
          r.start_datetime,
          r.expiry_datetime,
          r['Lived Name'] || '',
          r.Remarks || '',
          r.csn,
          r.photo ? '(set)' : '(none)',
          r.face_image_file1 ? '(set)' : '(none)',
          r.face_image_file2 ? '(set)' : '(none)',
        ]);
      });

      // Create failed records table
      const failedRecords = formattedRecords.filter(
        (r) => r.original_campus_entry.toString().toUpperCase() === 'N',
      );

      const failedTable = new Table({
        ...tableConfig,
        style: {
          head: ['red'],
          border: ['red'],
        },
      });

      // Add failed records to the table
      failedRecords.slice(0, 14).forEach((r) => {
        failedTable.push([
          r.user_id,
          r.name,
          r.department,
          r.user_title,
          r.phone || '',
          r.email || '',
          r.user_group,
          r.start_datetime,
          r.expiry_datetime,
          r['Lived Name'] || '',
          r.Remarks || '',
          r.csn,
          r.photo ? '(set)' : '(none)',
          r.face_image_file1 ? '(set)' : '(none)',
          r.face_image_file2 ? '(set)' : '(none)',
        ]);
      });

      this.logger.log(
        `
CSV Contents to be uploaded:
${table.toString()}
... ${formattedRecords.length > 100 ? `and ${formattedRecords.length - 100} more records` : ''}

Failed Records (${failedRecords.length} total):
${failedTable.toString()}
`,
      );

      // After processing records, write skipped records to log file
      if (skippedRecords.length > 0) {
        const skippedTable = new Table({
          ...tableConfig,
          style: {
            head: ['yellow'], // Using yellow since cli-table3 doesn't support orange
            border: ['yellow'],
          },
        });

        // Add skipped records to table
        skippedRecords.forEach((r) => {
          skippedTable.push([
            r.ID_Number,
            r.Name,
            'DLSU',
            'Student',
            '',
            '',
            'All Users',
            startDate,
            r.Campus_Entry?.toString()?.toUpperCase() === 'N'
              ? expiryDateDisabled
              : expiryDateEnabled,
            r.Lived_Name || '',
            r.Remarks || '',
            r.ID_Number,
            r.Photo ? '(set)' : '(none)',
            r.Photo ? '(set)' : '(none)',
            r.Photo ? '(set)' : '(none)',
          ]);
        });

        this.logger.log(
          `
Skipped Records (${skippedRecords.length} total):
${skippedTable.toString()}
`,
        );

        this.ensureLogDirectory();
        const logFile = path.join(
          this.logDir,
          `skipped_${new Date().toISOString().split('T')[0]}.json`,
        );
        fs.writeFileSync(logFile, JSON.stringify(skippedRecords, null, 2));
        this.logger.log(
          `Saved ${skippedRecords.length} skipped records to ${logFile}`,
        );
      }

      await csvWriter.writeRecords(formattedRecords);
      this.logger.log(`CSV file created at ${csvFilePath}`);

      // After successful CSV upload and before cleanup
      await this.logSyncedRecords(formattedRecords, jobName);

      // 6. Upload to API with retries
      let retries = 3;
      while (retries > 0) {
        try {
          const { token, sessionId } = await this.getApiToken();

          // Step 1: Upload the CSV file to /api/attachments
          const uploadFormData = new FormData();
          uploadFormData.append('file', fs.createReadStream(csvFilePath));

          this.logger.log('Uploading CSV file to attachments...');
          const uploadResponse = await axios.post(
            `${this.apiBaseUrl}/api/attachments`,
            uploadFormData,
            {
              headers: {
                ...uploadFormData.getHeaders(),
                Authorization: `Bearer ${token}`,
                'bs-session-id': sessionId,
              },
              maxBodyLength: Infinity,
              maxContentLength: Infinity,
              timeout: 30000,
              httpsAgent: new https.Agent({
                rejectUnauthorized: false,
              }),
            },
          );

          if (!uploadResponse.data?.filename) {
            throw new Error('Failed to get filename from upload response');
          }

          const uploadedFileName = uploadResponse.data.filename;
          this.logger.log(`File uploaded successfully as: ${uploadedFileName}`);

          // Step 2: Import the uploaded CSV
          const firstLine = fs.readFileSync(csvFilePath, 'utf8').split('\n')[0];
          const headers = firstLine.split(',');

          const importPayload = {
            File: {
              uri: uploadedFileName,
              fileName: uploadedFileName,
            },
            CsvOption: {
              columns: {
                total: headers.length.toString(),
                rows: headers,
                formats: headers.map(() => 'Text'),
              },
              start_line: 2,
              import_option: 2,
            },
            Query: {
              headers: headers,
              columns: headers,
            },
          };

          this.logger.log('Importing CSV file...');
          const importResponse = await axios.post(
            `${this.apiBaseUrl}/api/users/csv_import`,
            importPayload,
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                'bs-session-id': sessionId,
              },
              httpsAgent: new https.Agent({
                rejectUnauthorized: false,
              }),
            },
          );

          if (importResponse.data?.Response?.code === '1') {
            // Code 1 means partial success
            this.logger.log(
              'Partial success detected, analyzing failed rows...',
            );

            // Log which rows failed (from CsvRowCollection)
            if (importResponse.data.CsvRowCollection) {
              const failedRows = importResponse.data.CsvRowCollection.rows;
              this.logger.warn(
                `Failed rows (line numbers): ${failedRows.join(', ')}`,
              );

              // Read original CSV to get the actual data that failed
              const csvLines = fs.readFileSync(csvFilePath, 'utf8').split('\n');

              this.logger.warn('Failed records:');
              failedRows.forEach((rowNum) => {
                if (rowNum < csvLines.length) {
                  this.logger.warn(`Line ${rowNum}: ${csvLines[rowNum - 1]}`);
                }
              });

              // Log error file name for reference
              if (importResponse.data.File?.uri) {
                this.logger.warn(
                  `Error details file generated: ${importResponse.data.File.uri}`,
                );
              }

              throw new BadRequestException({
                message: `Import partially successful. ${failedRows.length} rows failed to import.`,
                details: `Failed rows: ${failedRows.join(', ')}`,
                biostarMessage: importResponse.data?.Response?.message,
                failedRows: failedRows,
              });
            }
          } else if (importResponse.data?.Response?.code !== '0') {
            this.logger.error('Import API Response:', importResponse.data);

            // Handle specific error codes with enhanced messages
            let errorMessage;
            switch (importResponse.data?.Response?.code) {
              case '20':
                errorMessage =
                  'Permission denied. Please check API credentials and permissions.';
                break;
              case '211':
                errorMessage =
                  'Field mapping error. Please check CSV format and required fields.';
                break;
              case '105':
                errorMessage =
                  'Invalid query parameters. Please check CSV format and field mappings.';
                break;
              default:
                errorMessage = 'Unknown error occurred during import';
            }

            throw new BadRequestException({
              message: errorMessage,
              details: importResponse.data,
              biostarMessage: importResponse.data?.Response?.message,
              step: 'csv-import',
            });
          } else {
            // Success case (code === '0')
            this.logger.log(
              `CSV import successful - All ${formattedRecords.length} records processed`,
            );
          }

          this.logger.log('CSV file uploaded successfully');
          break;
        } catch (error) {
          retries--;
          const errorMessage = axios.isAxiosError(error)
            ? `API Error: ${error.response?.status} - ${error.response?.data?.message || error.message}`
            : `Upload Error: ${error.message}`;

          if (retries === 0) {
            this.logger.error(`Final upload attempt failed: ${errorMessage}`);
            throw new BadRequestException({
              message: 'CSV upload failed after all retries',
              details: errorMessage,
              biostarMessage: axios.isAxiosError(error)
                ? error.response?.data?.Response?.message
                : undefined,
              step: 'csv-upload',
            });
          }

          this.logger.warn(
            `Upload attempt failed (${retries} retries left): ${errorMessage}`,
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

      return {
        success: true,
        message: 'Sync completed successfully',
        recordsProcessed: formattedRecords.length,
      };
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
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error('Manual sync failed:', error);
      throw new BadRequestException({
        message: 'Manual Sync Failed',
        details: error.message,
        biostarMessage: error.response?.data?.Response?.message,
        step: error.step || 'unknown',
        queueId,
      });
    }
  }

  async testConnection() {
    let pool: sql.ConnectionPool | null = null;
    let sqlServerConnected = false;
    let biostarConnected = false;
    let postgresConnected = false;

    try {
      this.logger.log('Testing all connections...');

      // Test 1: SQL Server Connection
      this.logger.log('1. Testing SQL Server connection...');
      pool = await sql.connect(this.sqlConfig);
      const hasIsArchivedColumn = await this.checkColumnExists(
        pool,
        'isArchived',
      );
      const query = hasIsArchivedColumn
        ? `SELECT TOP 1 * FROM ISGATE_MASTER_VW WHERE isArchived = 0 ORDER BY ID_Number`
        : `SELECT TOP 1 * FROM ISGATE_MASTER_VW ORDER BY ID_Number`;
      const sqlResult = await pool.request().query(query);
      sqlServerConnected = true;
      this.logger.log('SQL Server connection successful');

      // Test 2: BIOSTAR API Connection
      this.logger.log('2. Testing BIOSTAR API connection...');
      const { token, sessionId } = await this.getApiToken();
      biostarConnected = true;
      this.logger.log('BIOSTAR API connection successful');

      // Test 3: PostgreSQL Connection
      this.logger.log('3. Testing PostgreSQL connection...');
      const pgResult = await this.studentRepository
        .createQueryBuilder()
        .select('COUNT(*)')
        .from(Student, 'student')
        .getRawOne();
      postgresConnected = true;
      this.logger.log('PostgreSQL connection successful');

      return {
        success: true,
        message: 'All connections successful',
        postgresConnected,
        biostarConnected,
        sqlServerConnected,
        connections: {
          sqlServer: {
            status: 'connected',
            sampleData: sqlResult.recordset[0],
            tableInfo: {
              hasIsArchivedColumn,
              recordCount: sqlResult.recordset.length,
            },
          },
          biostarApi: {
            status: 'connected',
            sessionId: sessionId ? 'valid' : 'invalid',
            token: token ? 'valid' : 'invalid',
          },
          postgresql: {
            status: 'connected',
            totalRecords: pgResult?.count || 0,
          },
        },
      };
    } catch (error) {
      this.logger.error('Connection test failed:', error);

      // Determine which connection failed based on where the error occurred
      let failedConnection = 'unknown';
      if (error.message?.includes('SQL Server')) {
        failedConnection = 'SQL Server';
      } else if (error.message?.includes('BIOSTAR API')) {
        failedConnection = 'BIOSTAR API';
      } else if (error.message?.includes('PostgreSQL')) {
        failedConnection = 'PostgreSQL';
      }

      throw new BadRequestException({
        message: `Connection test failed`,
        failedConnection,
        postgresConnected,
        biostarConnected,
        sqlServerConnected,
        error: error.message,
        details: axios.isAxiosError(error) ? error.response?.data : undefined,
      });
    } finally {
      if (pool) {
        await pool.close();
        this.logger.log('SQL Server connection closed');
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

  public async deleteUsers(userIds: string[]) {
    if (!userIds?.length) {
      throw new BadRequestException('No user IDs provided for deletion');
    }

    let updateResult;

    try {
      this.logger.log(`Starting bulk deletion for ${userIds.length} users`);

      // 1. Update PostgreSQL records
      updateResult = await this.studentRepository
        .createQueryBuilder()
        .update(Student)
        .set({ isArchived: true })
        .where('ID_Number IN (:...userIds)', { userIds })
        .execute();

      this.logger.log(`Updated ${updateResult.affected} records in PostgreSQL`);

      // 2. Delete from BIOSTAR API
      const { token, sessionId } = await this.getApiToken();

      // First API call - Delete card records
      const deleteCardPayload = {
        mobile: {
          user_id: userIds,
          card_id: [],
          param: {
            UserIDs: userIds,
            query: {},
          },
        },
      };

      await axios.post(
        `${this.apiBaseUrl}/api/v2/mobile/delete`,
        deleteCardPayload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'bs-session-id': sessionId,
            'Content-Type': 'application/json',
          },
          httpsAgent: new https.Agent({
            rejectUnauthorized: false,
          }),
        },
      );

      this.logger.log(
        'Successfully deleted user card records from BIOSTAR API',
      );

      // Second API call - Delete user records
      const formattedIds = userIds
        .map((id) => encodeURIComponent(id))
        .join('%2B');
      const deleteUserResponse = await axios.delete(
        `${this.apiBaseUrl}/api/users?id=${formattedIds}&group_id=1`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'bs-session-id': sessionId,
            accept: 'application/json',
          },
          httpsAgent: new https.Agent({
            rejectUnauthorized: false,
          }),
        },
      );

      this.logger.log('Successfully deleted user records from BIOSTAR API');
      return {
        success: true,
        message: 'Users and their card records successfully deleted',
        deletedCount: updateResult.affected,
        biostarResponse: deleteUserResponse.data,
      };
    } catch (error) {
      this.logger.error('Bulk deletion failed:', error);

      // Revert PostgreSQL changes if they were made
      if (updateResult?.affected > 0) {
        try {
          await this.studentRepository
            .createQueryBuilder()
            .update(Student)
            .set({ isArchived: false })
            .where('ID_Number IN (:...userIds)', { userIds })
            .execute();

          this.logger.log(
            'Successfully reverted PostgreSQL changes after BIOSTAR API failure',
          );
        } catch (revertError) {
          this.logger.error(
            'Failed to revert PostgreSQL changes:',
            revertError,
          );
          throw new BadRequestException({
            message:
              'Critical error: Failed to revert PostgreSQL changes after BIOSTAR API failure',
            details: revertError.message,
            originalError: error.message,
            step: 'postgres-reversion',
          });
        }
      }

      // Throw appropriate error
      throw new BadRequestException({
        message: 'Bulk deletion failed',
        details: axios.isAxiosError(error)
          ? error.response?.data
          : error.message,
        biostarMessage: axios.isAxiosError(error)
          ? error.response?.data?.Response?.message
          : undefined,
        step: 'biostar-deletion',
      });
    }
  }
}
