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
import * as sharp from 'sharp';

@Injectable()
export class DatabaseSyncService {
  private readonly logger = new Logger(DatabaseSyncService.name);
  private readonly activeJobs = new Map<string, boolean>();
  private readonly jobStartTimes = new Map<string, Date>();
  private sqlConfig: sql.config;
  private apiBaseUrl: string;
  private apiCredentials: { login_id: string; password: string };
  private readonly logDir = path.join(process.cwd(), 'logs', 'skipped-records');

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
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Cleanup logs older than 1 month
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    fs.readdirSync(this.logDir).forEach((file) => {
      const filePath = path.join(this.logDir, file);
      const stats = fs.statSync(filePath);
      if (stats.mtime < oneMonthAgo) {
        fs.unlinkSync(filePath);
      }
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

      if (typeof photoData === 'string' && photoData.length > 0) {
        try {
          imageBuffer = fs.readFileSync(photoData);
        } catch {
          imageBuffer = fs.readFileSync(path.join(process.cwd(), 'dlsu.png'));
        }
      } else if (photoData instanceof Buffer) {
        imageBuffer = photoData;
      } else {
        imageBuffer = fs.readFileSync(path.join(process.cwd(), 'dlsu.png'));
      }

      // Compression for 46 char limit
      const compressedBuffer = await sharp(imageBuffer)
        .resize(8, 8) // Larger thumbnail
        .jpeg({ quality: 20 }) // Better quality
        .toBuffer();

      const base64String = compressedBuffer.toString('base64');
      return `Base64: ${base64String.substring(0, 38)}`; // "Base64: " is 8 chars, leaving 38 for data
    } catch (error) {
      this.logger.error('Error converting photo to base64:', error);
      return null;
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

      if (allRecords.length === 0) {
        this.logger.log('No records to sync');
        return;
      }

      this.logger.log(`Found ${allRecords.length} records to sync`);

      // 4. Sync data to PostgreSQL
      this.logger.log('Syncing data to PostgreSQL database');
      let updatedCount = 0;
      let skippedCount = 0;

      for (const record of allRecords) {
        let student = await this.studentRepository.findOne({
          where: {
            ID_Number: record.ID_Number,
          },
        });

        if (!student) {
          student = this.studentRepository.create();
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
          updatedCount++;
        } else {
          // Check if any fields have changed
          const hasChanges =
            student.Name !== record.Name ||
            student.Lived_Name !== record.Lived_Name ||
            student.Remarks !== record.Remarks ||
            student.Photo !== record.Photo ||
            student.Campus_Entry !== record.Campus_Entry ||
            student.Unique_ID !== record.Unique_ID ||
            student.isArchived !== record.isArchived;

          if (hasChanges) {
            Object.assign(student, {
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
            updatedCount++;
          } else {
            skippedCount++;
          }
        }
      }

      this.logger.log(
        `Synced ${updatedCount} records to PostgreSQL (${skippedCount} unchanged records skipped)`,
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
        ],
      });

      // Transform records to match format
      const skippedRecords = [];

      const formattedRecords = (
        await Promise.all(
          allRecords.map(async (record) => {
            const userId = this.removeSpecialChars(
              record.ID_Number?.toString()?.trim() || '',
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
              photo: await this.convertPhotoToBase64(record.Photo),
            };
          }),
        )
      ).filter((record) => record !== null);

      // After processing records, write skipped records to log file
      if (skippedRecords.length > 0) {
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
                rows: [headers[0].trim()],
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

  async deleteUsers(userIds: string[]) {
    if (!userIds?.length) {
      throw new BadRequestException('No user IDs provided for deletion');
    }

    try {
      this.logger.log(`Starting bulk deletion for ${userIds.length} users`);

      // 1. Update PostgreSQL records
      const updateResult = await this.studentRepository
        .createQueryBuilder()
        .update(Student)
        .set({ isArchived: true })
        .where('ID_Number IN (:...userIds)', { userIds })
        .execute();

      this.logger.log(`Updated ${updateResult.affected} records in PostgreSQL`);

      // 2. Delete from BIOSTAR API
      const { token, sessionId } = await this.getApiToken();

      // Format user IDs as required by BIOSTAR API
      const formattedIds = userIds
        .map((id) => encodeURIComponent(id))
        .join('%2B');

      try {
        const url = `${this.apiBaseUrl}/api/users?id=${formattedIds}&group_id=1`;
        const deleteResponse = await axios.delete(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            'bs-session-id': sessionId,
            accept: 'application/json',
          },
          httpsAgent: new https.Agent({
            rejectUnauthorized: false,
          }),
        });

        // Check response
        if (deleteResponse.data?.Response?.code === '1003') {
          this.logger.log('Successfully deleted users from BIOSTAR API');
          return {
            success: true,
            message: 'Users successfully deleted',
            deletedCount: updateResult.affected,
            biostarResponse: deleteResponse.data,
          };
        } else {
          throw new Error(
            `Unexpected BIOSTAR API response: ${JSON.stringify(
              deleteResponse.data,
            )}`,
          );
        }
      } catch (error) {
        this.logger.error('BIOSTAR API request failed:', {
          url: `${this.apiBaseUrl}/api/users?id=${formattedIds}&group_id=1`,
          error: error.message,
        });

        // If BIOSTAR deletion fails, revert PostgreSQL changes
        await this.studentRepository
          .createQueryBuilder()
          .update(Student)
          .set({ isArchived: false })
          .where('ID_Number IN (:...userIds)', { userIds })
          .execute();

        throw new BadRequestException({
          message: 'Failed to delete users from BIOSTAR API',
          details: axios.isAxiosError(error)
            ? error.response?.data
            : error.message,
          biostarMessage: axios.isAxiosError(error)
            ? error.response?.data?.Response?.message
            : undefined,
          requestUrl: `${this.apiBaseUrl}/api/users?id=${formattedIds}&group_id=1`,
          step: 'biostar-deletion',
        });
      }
    } catch (error) {
      this.logger.error('Bulk deletion failed:', error);
      throw new BadRequestException({
        message: 'Bulk deletion failed',
        details: error.message,
        biostarMessage: error.response?.biostarMessage,
        step: error.step || 'unknown',
      });
    }
  }
}
