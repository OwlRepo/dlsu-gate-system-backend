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
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

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

      if (typeof photoData === 'string' && photoData.length > 0) {
        try {
          // Check if the photo file exists before trying to read it
          if (fs.existsSync(photoData)) {
            imageBuffer = fs.readFileSync(photoData);
          } else {
            this.logger.warn(
              `Photo file not found at path: ${photoData}, using default image`,
            );
            imageBuffer = fs.readFileSync(defaultImagePath);
          }
        } catch (readError) {
          this.logger.warn(
            `Error reading photo file: ${readError.message}, using default image`,
          );
          imageBuffer = fs.readFileSync(defaultImagePath);
        }
      } else if (photoData instanceof Buffer) {
        imageBuffer = photoData;
      } else {
        this.logger.debug('No valid photo data provided, using default image');
        imageBuffer = fs.readFileSync(defaultImagePath);
      }

      if (!imageBuffer || imageBuffer.length === 0) {
        this.logger.warn('Empty image buffer detected, returning null');
        return null;
      }

      const base64String = imageBuffer.toString('base64');
      return base64String;
    } catch (error) {
      this.logger.error('Error converting photo to base64:', error);
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

      // Create log directory for SQL data if it doesn't exist
      const sqlLogDir = path.join(process.cwd(), 'logs', 'sql-data');
      if (!fs.existsSync(sqlLogDir)) {
        fs.mkdirSync(sqlLogDir, { recursive: true });
      }

      // Create log filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sqlLogPath = path.join(
        sqlLogDir,
        `sql_fetch_${jobName}_${timestamp}.json`,
      );

      // 1. Connect to SQL Server and check isArchived column
      pool = await sql.connect(this.sqlConfig);
      const hasIsArchivedColumn = await this.checkColumnExists(
        pool,
        'isArchived',
      );

      // 2. Fetch and process data in batches
      const batchSize = 1000;
      let offset = 0;
      let totalProcessed = 0;
      const skippedRecords: any[] = [];
      let formattedRecords: any[] = [];
      const sqlFetchLog: any[] = [];

      // Prepare CSV writer once
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

      // Calculate dates once
      const currentDate = dayjs().utc();
      const startDate = currentDate
        .subtract(10, 'year')
        .format('YYYYMMDD HH:mm:ss.SSS');
      const expiryDateEnabled = currentDate
        .add(10, 'year')
        .format('YYYYMMDD HH:mm:ss.SSS');
      const expiryDateDisabled = currentDate
        .subtract(1, 'month')
        .format('YYYYMMDD HH:mm:ss.SSS');

      while (true) {
        // Fetch batch of records
        const query = hasIsArchivedColumn
          ? `SELECT * FROM ISGATE_MASTER_VW WHERE isArchived = 0 ORDER BY ID_Number OFFSET ${offset} ROWS FETCH NEXT ${batchSize} ROWS ONLY`
          : `SELECT * FROM ISGATE_MASTER_VW ORDER BY ID_Number OFFSET ${offset} ROWS FETCH NEXT ${batchSize} ROWS ONLY`;

        const result = await pool.request().query(query);
        if (result.recordset.length === 0) break;

        // Log the raw data from SQL Server
        sqlFetchLog.push({
          batch: Math.floor(offset / batchSize) + 1,
          timestamp: new Date().toISOString(),
          recordCount: result.recordset.length,
          records: result.recordset.map((record) => ({
            ID_Number: record.ID_Number,
            Unique_ID: record.Unique_ID,
            Name: record.Name,
            Lived_Name: record.Lived_Name,
            Remarks: record.Remarks,
            Campus_Entry: record.Campus_Entry,
            // Don't log photo data to save space
            hasPhoto: !!record.Photo,
          })),
        });

        // Process batch
        const batchRecords = await Promise.all(
          result.recordset.map(async (record) => {
            const userId = this.hexToDecimal(
              record.Unique_ID
                ? record.Unique_ID?.toString()?.trim()
                : record.ID_Number
                  ? record.ID_Number?.toString()?.trim()
                  : '',
              record.ID_Number,
            );
            const name = this.removeSpecialChars(record.Name?.trim() || '');
            const livedName = record.Lived_Name?.trim() || '';
            const remarks = record.Remarks?.trim() || '';

            // Validation
            if (!this.validateRecord(userId, name, livedName, remarks)) {
              skippedRecords.push({
                ID_Number: record.ID_Number,
                reasons: this.getValidationErrors(
                  userId,
                  name,
                  livedName,
                  remarks,
                ),
                timestamp: new Date().toISOString(),
              });
              return null;
            }

            // Convert photo once per record
            const photo = await this.convertPhotoToBase64(record.Photo);

            return {
              user_id: userId,
              name: name,
              department: 'DLSU',
              user_title: 'Student',
              phone: '',
              email: '',
              user_group: 'All Users',
              'Lived Name': livedName,
              Remarks: remarks,
              csn: userId,
              photo,
              face_image_file1: photo,
              face_image_file2: photo,
              start_datetime: startDate,
              expiry_datetime:
                record.Campus_Entry.toString().toUpperCase() === 'N'
                  ? expiryDateDisabled
                  : expiryDateEnabled,
              original_campus_entry: record.Campus_Entry,
            };
          }),
        );

        // Filter out null records and add to formatted records
        const validRecords = batchRecords.filter((record) => record !== null);
        formattedRecords = formattedRecords.concat(validRecords);

        // Write batch to CSV
        await csvWriter.writeRecords(validRecords);

        totalProcessed += result.recordset.length;
        offset += batchSize;

        // Write logs every 5000 records or on the last batch
        if (
          sqlFetchLog.length * batchSize >= 5000 ||
          result.recordset.length < batchSize
        ) {
          this.logger.log(`Writing SQL fetch log to ${sqlLogPath}`);
          fs.writeFileSync(
            sqlLogPath,
            JSON.stringify(
              {
                jobName,
                startTime: this.jobStartTimes.get(jobName),
                totalProcessed,
                batches: sqlFetchLog,
              },
              null,
              2,
            ),
          );
        }

        this.logger.log(`Processed ${totalProcessed} records...`);
      }

      // Log final summary
      this.logger.log(`SQL Server data fetch completed:
        Total records processed: ${totalProcessed}
        Valid records: ${formattedRecords.length}
        Skipped records: ${skippedRecords.length}
        Log file: ${sqlLogPath}
      `);

      if (formattedRecords.length === 0) {
        this.logger.log('No records found to sync');
        await this.updateLastSyncTime(jobName);
        return {
          success: true,
          message: 'No records to process',
          recordsProcessed: 0,
        };
      }

      // Log sync statistics
      this.logSyncStatistics(formattedRecords, skippedRecords);

      // Upload to BIOSTAR API with retries
      await this.uploadToBiostar(csvFilePath);

      // Log synced records and update sync time
      await this.logSyncedRecords(formattedRecords, jobName);
      await this.updateLastSyncTime(jobName);

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
      }
      if (pool) {
        await pool.close();
      }
      this.activeJobs.set(jobName, false);
      this.jobStartTimes.delete(jobName);
    }
  }

  // Helper methods to keep the main function clean
  private validateRecord(
    userId: string,
    name: string,
    livedName: string,
    remarks: string,
  ): boolean {
    return (
      userId &&
      userId.length <= 11 &&
      name &&
      name.length <= 48 &&
      livedName.length <= 48 &&
      remarks.length <= 48
    );
  }

  private getValidationErrors(
    userId: string,
    name: string,
    livedName: string,
    remarks: string,
  ): string[] {
    const errors = [];
    if (!userId) errors.push('Empty ID');
    if (userId.length > 11) errors.push('ID too long');
    if (!name) errors.push('Empty name');
    if (name.length > 48) errors.push('Name exceeds 48 characters');
    if (livedName.length > 48) errors.push('Lived name exceeds 48 characters');
    if (remarks.length > 48) errors.push('Remarks exceeds 48 characters');
    return errors;
  }

  private async uploadToBiostar(csvFilePath: string) {
    let retries = 3;
    while (retries > 0) {
      try {
        const { token, sessionId } = await this.getApiToken();

        // Upload CSV file
        const uploadFormData = new FormData();
        uploadFormData.append('file', fs.createReadStream(csvFilePath));

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
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
          },
        );

        const uploadedFileName = uploadResponse.data?.filename;
        if (!uploadedFileName)
          throw new Error('Failed to get filename from upload response');

        // Import the uploaded CSV
        await this.importCsvToBiostar(
          uploadedFileName,
          token,
          sessionId,
          csvFilePath,
        );
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  private async updateLastSyncTime(jobName: string) {
    const scheduleNumber = parseInt(jobName.replace('sync-', ''));
    if (!isNaN(scheduleNumber)) {
      const schedule = await this.syncScheduleRepository.findOne({
        where: { scheduleNumber },
      });
      if (schedule) {
        schedule.lastSyncTime = new Date();
        await this.syncScheduleRepository.save(schedule);
      }
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

  private logSyncStatistics(formattedRecords: any[], skippedRecords: any[]) {
    const enabledCount = formattedRecords.filter(
      (r) => r.original_campus_entry.toString().toUpperCase() === 'Y',
    ).length;
    const disabledCount = formattedRecords.filter(
      (r) => r.original_campus_entry.toString().toUpperCase() === 'N',
    ).length;

    this.logger.log(`
Data Summary:
-------------
Total Records: ${formattedRecords.length}
Enabled Accounts (Campus Entry: Y): ${enabledCount}
Disabled Accounts (Campus Entry: N): ${disabledCount}
Skipped Records: ${skippedRecords.length}
-------------`);
  }

  private async importCsvToBiostar(
    uploadedFileName: string,
    token: string,
    sessionId: string,
    csvFilePath: string,
  ) {
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

    const importResponse = await axios.post(
      `${this.apiBaseUrl}/api/users/csv_import`,
      importPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'bs-session-id': sessionId,
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      },
    );

    if (importResponse.data?.Response?.code === '1') {
      throw new BadRequestException({
        message: 'CSV import partially failed',
        details: importResponse.data,
      });
    } else if (importResponse.data?.Response?.code !== '0') {
      throw new BadRequestException({
        message: 'CSV import failed',
        details: importResponse.data,
      });
    }
  }

  private hexToDecimal(
    hexString: string,
    originalId?: string | number,
  ): string {
    try {
      // Remove any non-hex characters and convert to uppercase
      const cleanHex = hexString.replace(/[^A-Fa-f0-9]/g, '').toUpperCase();

      if (!cleanHex) return originalId?.toString() || '';

      // Convert hex to decimal
      const decimal = BigInt(`0x${cleanHex}`).toString(10);
      return decimal;
    } catch (error) {
      this.logger.warn(
        `Failed to convert hex value: ${hexString}, using original ID`,
        error,
      );
      return originalId?.toString() || '';
    }
  }
}
