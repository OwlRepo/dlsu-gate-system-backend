import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncSchedule } from './entities/sync-schedule.entity';
import { ConfigService } from '@nestjs/config';
import { ScheduledSyncDto } from './dto/scheduled-sync.dto';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import * as sql from 'mssql';
import * as fs from 'fs';
import axios from 'axios';
import { createObjectCsvWriter } from 'csv-writer';
import * as path from 'path';
import { Student } from '../students/entities/student.entity';
import * as https from 'https';
import * as FormData from 'form-data';
import { In } from 'typeorm';
import * as sharp from 'sharp';
import { DatabaseSyncQueueService } from './database-sync-queue.service';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

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
  private readonly photoConversionLogDir = path.join(
    process.cwd(),
    'logs',
    'photo-conversion',
  );
  private readonly faceImagesDir = path.join(
    process.cwd(),
    'temp',
    'face-images',
  );

  constructor(
    @InjectRepository(SyncSchedule)
    private syncScheduleRepository: Repository<SyncSchedule>,
    @InjectRepository(Student)
    private studentRepository: Repository<Student>,
    private configService: ConfigService,
    private schedulerRegistry: SchedulerRegistry,
    private databaseSyncQueueService: DatabaseSyncQueueService,
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
        connectTimeout: 120000,
        requestTimeout: 120000,
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 120000,
      },
    };

    this.apiBaseUrl = this.configService.get('BIOSTAR_API_BASE_URL');
    this.apiCredentials = {
      login_id: this.configService.get('BIOSTAR_API_LOGIN_ID'),
      password: this.configService.get('BIOSTAR_API_PASSWORD'),
    };

    this.ensureLogDirectory();
    this.ensureFaceImagesDirectory();
  }

  private ensureLogDirectory() {
    const directories = [
      this.logDir,
      this.syncedDir,
      this.syncedJsonDir,
      this.syncedCsvDir,
      this.photoConversionLogDir,
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

  private ensureFaceImagesDirectory() {
    if (!fs.existsSync(this.faceImagesDir)) {
      fs.mkdirSync(this.faceImagesDir, { recursive: true });
    }
  }

  private removeSpecialChars(str: string): string {
    return str.replace(/[^a-zA-Z0-9\s]/g, '');
  }

  private sanitizeUserId(userId: string): string | null {
    // Remove spaces from the userId first
    const cleanUserId = userId.replace(/\s/g, '');
    // Convert hex to decimal if userId is a valid hex number
    if (/^[0-9A-Fa-f]+$/.test(cleanUserId)) {
      const decimal = parseInt(cleanUserId, 16);
      if (isNaN(decimal)) {
        return null;
      }
      userId = decimal.toString();
    }
    // Ensure the userId has a maximum of 10 characters
    if (userId.length > 10) {
      userId = userId.substring(0, 10);
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
    // No need to convert to UTC since we're using Asia/Manila timezone in CronJob
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
          ? new Date(schedule.lastSyncTime)
          : null,
        nextRun: job?.nextDate()?.toJSDate()
          ? new Date(job.nextDate().toJSDate())
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
        WHERE object_id = OBJECT_ID('${this.configService.get('SOURCE_DB_TABLE')}')
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

  private logPhotoConversionFailure(
    photoData: any,
    reason: string,
    studentId?: string,
  ) {
    try {
      const dateString = new Date().toISOString().split('T')[0];
      const logFile = path.join(
        this.photoConversionLogDir,
        `photo_conversion_failures_${dateString}.json`,
      );

      let existingLogs = [];
      if (fs.existsSync(logFile)) {
        existingLogs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
      }

      const logEntry = {
        timestamp: new Date().toISOString(),
        studentId: studentId || 'unknown',
        reason,
        photoDataType: typeof photoData,
        photoDataSample:
          typeof photoData === 'string'
            ? photoData.slice(0, 100) + '...'
            : null,
        isBuffer: Buffer.isBuffer(photoData),
        isBlob: photoData instanceof Blob,
        hasData: photoData && 'data' in photoData,
      };

      existingLogs.push(logEntry);
      fs.writeFileSync(logFile, JSON.stringify(existingLogs, null, 2));
    } catch (error) {
      this.logger.error('Failed to log photo conversion failure');
    }
  }

  private async useDefaultImage(reason: string): Promise<string> {
    const defaultImagePath = path.join(process.cwd(), 'dlsu.png');

    this.logger.debug('Attempting to use default image', {
      reason,
      defaultImagePath,
      exists: fs.existsSync(defaultImagePath),
    });

    try {
      const defaultImageBuffer = fs.readFileSync(defaultImagePath);
      const base64Image = defaultImageBuffer.toString('base64');
      return `data:image/png;base64,${base64Image}`;
    } catch (error) {
      this.logger.error('Failed to read default image', {
        error: error.message,
        path: defaultImagePath,
      });
      throw new Error('Failed to read default image');
    }
  }

  private async convertPhotoToBase64(
    photoData: any,
    studentId: string,
  ): Promise<string> {
    try {
      let imageBuffer: Buffer;

      if (typeof photoData === 'string') {
        // Handles Windows paths (both C:\ style and UNC \\server style)
        if (photoData.match(/^[a-zA-Z]:\\|^\\\\/)) {
          try {
            if (fs.existsSync(photoData)) {
              imageBuffer = fs.readFileSync(photoData);
              this.logger.debug('Successfully read image from file path', {
                studentId,
                path: photoData,
              });
            } else {
              this.logger.warn('File path exists but file not found', {
                studentId,
                path: photoData,
              });
              return this.useDefaultImage('File not found');
            }
          } catch (error) {
            this.logger.error('Failed to read file from path', {
              studentId,
              path: photoData,
              error: error.message,
            });
            return this.useDefaultImage('Failed to read file');
          }
        } else if (photoData.startsWith('0x')) {
          try {
            const hexData = photoData.slice(2);
            if (!/^[0-9A-Fa-f]+$/.test(hexData)) {
              throw new Error('Invalid hex string format');
            }
            imageBuffer = Buffer.from(hexData, 'hex');

            // Check if we need to swap byte order
            if (
              imageBuffer.length >= 14 &&
              imageBuffer.slice(0, 2).toString() === 'BM'
            ) {
              const originalSize = imageBuffer.readUInt32BE(2); // Read as big-endian
              if (originalSize > imageBuffer.length) {
                // Try swapping byte order for size field
                const size =
                  ((originalSize & 0xff) << 24) |
                  ((originalSize & 0xff00) << 8) |
                  ((originalSize & 0xff0000) >> 8) |
                  ((originalSize & 0xff000000) >> 24);

                this.logger.debug(
                  'Photo conversion debug - attempting byte order correction',
                  {
                    studentId,
                    originalSize,
                    correctedSize: size,
                    bufferLength: imageBuffer.length,
                  },
                );

                // If the corrected size looks valid, swap the bytes
                if (size <= imageBuffer.length) {
                  const newBuffer = Buffer.alloc(imageBuffer.length);
                  imageBuffer.copy(newBuffer); // Copy original data
                  newBuffer.writeUInt32LE(size, 2); // Write corrected size
                  imageBuffer = newBuffer;
                }
              }
            }
          } catch (error) {
            this.logger.error('Failed to convert hex string to buffer', {
              studentId,
              error: error.message,
            });
            return this.useDefaultImage(
              'Failed to convert hex string to buffer',
            );
          }
        } else {
          imageBuffer = Buffer.from(photoData, 'base64');
        }
      } else if (Buffer.isBuffer(photoData)) {
        imageBuffer = photoData;
      } else {
        return this.useDefaultImage('Invalid photo data type');
      }

      // Get first 4 bytes as hex for signature checking
      const signature = imageBuffer.slice(0, 4).toString('hex');
      const extendedSignature = imageBuffer.slice(0, 8).toString('hex');

      // this.logger.debug('Photo conversion debug - signature check', {
      //   studentId,
      //   signature,
      //   extendedSignature,
      //   bufferLength: imageBuffer.length,
      //   isBuffer: Buffer.isBuffer(imageBuffer),
      // });

      // Validate image buffer
      if (!imageBuffer || imageBuffer.length === 0) {
        this.logger.warn('Empty image buffer detected, using default image');
        this.logPhotoConversionFailure(
          photoData,
          'Empty image buffer detected',
          studentId,
        );
        imageBuffer = fs.readFileSync(path.join(process.cwd(), 'dlsu.png'));
      }

      // Additional validation for corrupted images
      if (imageBuffer.length < 100) {
        this.logger.warn(
          'Suspiciously small image detected, using default image',
          {
            bufferLength: imageBuffer.length,
            originalDataType: typeof photoData,
          },
        );
        this.logPhotoConversionFailure(
          photoData,
          'Suspiciously small image detected',
          studentId,
        );
        imageBuffer = fs.readFileSync(path.join(process.cwd(), 'dlsu.png'));
      }

      // Try to validate image format
      try {
        // Detailed BMP structure analysis if it starts with 'BM'
        if (signature.startsWith('424d')) {
          // '424d' is 'BM'
          const fileSize = imageBuffer.readUInt32LE(2); // Size should be at offset 2
          const pixelOffset = imageBuffer.readUInt32LE(10); // Pixel array offset should be at 10
          const headerSize = imageBuffer.readUInt32LE(14); // DIB header size at offset 14

          this.logger.debug('BMP Header Analysis:', {
            signature,
            extendedSignature,
            fileSize,
            actualFileSize: imageBuffer.length,
            pixelOffset,
            headerSize,
            studentId,
            headerBytes: imageBuffer.slice(0, 54).toString('hex'), // First 54 bytes (standard BMP header)
            isValidSize: fileSize === imageBuffer.length,
            isValidPixelOffset: pixelOffset > 0 && pixelOffset < fileSize,
            isValidHeaderSize: [12, 40, 52, 56, 108, 124].includes(headerSize), // Common DIB header sizes
          });

          // If it's not a valid BMP structure, log and use default
          if (!this.isValidBmpStructure(imageBuffer)) {
            this.logger.warn('Invalid BMP structure detected', {
              reason: 'File structure does not match BMP format',
              signature,
              fileSize,
              actualFileSize: imageBuffer.length,
              pixelOffset,
              headerSize,
            });
            this.logPhotoConversionFailure(
              photoData,
              'Invalid BMP structure: Incorrect header values',
              studentId,
            );
            imageBuffer = fs.readFileSync(path.join(process.cwd(), 'dlsu.png'));
            return imageBuffer.toString('base64');
          }
        }

        // const supportedSignatures = {
        //   png: ['89504e47'], // PNG
        //   jpeg: [
        //     'ffd8ffe0', // JPEG
        //     'ffd8ffe1', // JPEG with EXIF
        //     'ffd8ffe2', // JPEG with SPIFF
        //     'ffd8ffe3', // JPEG with JFIF
        //   ],
        //   bmp: [
        //     '424d', // Standard BMP
        //     // Removing custom variants as they don't follow standard BMP structure
        //   ],
        // };

        // Check if signature matches any supported format
        // const isSupported = Object.values(supportedSignatures)
        //   .flat()
        //   .some((supported) => {
        //     const matches = signature.startsWith(supported);
        //     if (matches) {
        //       this.logger.debug(
        //         `Matched signature: ${supported} for format ${Object.keys(
        //           supportedSignatures,
        //         ).find((key) => supportedSignatures[key].includes(supported))}`,
        //       );
        //     }
        //     return matches;
        //   });

        // if (!isSupported) {
        //   this.logger.warn(
        //     'Invalid image signature detected, using default image',
        //     {
        //       signature,
        //       extendedSignature,
        //       bufferLength: imageBuffer.length,
        //       studentId,
        //       supportedFormats: Object.values(supportedSignatures).flat(),
        //     },
        //   );
        //   this.logPhotoConversionFailure(
        //     photoData,
        //     `Invalid image signature detected: ${signature}`,
        //     studentId,
        //   );
        //   imageBuffer = fs.readFileSync(path.join(process.cwd(), 'dlsu.png'));
        // } else {
        //   this.logger.debug('Valid image signature detected', {
        //     signature,
        //     studentId,
        //     format: Object.keys(supportedSignatures).find((key) =>
        //       supportedSignatures[key].some((s) => signature.startsWith(s)),
        //     ),
        //   });
        // }
      } catch (signatureError) {
        this.logger.error('Error checking image signature:', {
          error: signatureError.message,
          bufferLength: imageBuffer?.length,
        });
        this.logPhotoConversionFailure(
          photoData,
          'Error checking image signature',
          studentId,
        );
        imageBuffer = fs.readFileSync(path.join(process.cwd(), 'dlsu.png'));
      }

      const base64String = imageBuffer.toString('base64');
      return base64String;
    } catch (error) {
      this.logger.error('Critical error in convertPhotoToBase64:', {
        error: error.message,
        stack: error.stack,
        photoDataType: typeof photoData,
        photoDataSample:
          typeof photoData === 'string'
            ? photoData.slice(0, 100) + '...'
            : null,
      });
      this.logPhotoConversionFailure(
        photoData,
        'Critical error in convertPhotoToBase64',
        studentId,
      );
      return null;
    }
  }

  private isValidBmpStructure(buffer: Buffer): boolean {
    try {
      if (buffer.length < 54) return false; // Minimum size for BMP header

      const signature = buffer.slice(0, 2).toString('ascii');
      if (signature !== 'BM') return false;

      const fileSize = buffer.readUInt32LE(2);
      const pixelOffset = buffer.readUInt32LE(10);
      const headerSize = buffer.readUInt32LE(14);

      // Basic structure validation
      return (
        fileSize === buffer.length && // File size matches
        pixelOffset >= 54 &&
        pixelOffset < fileSize && // Valid pixel data offset
        [12, 40, 52, 56, 108, 124].includes(headerSize) && // Valid DIB header size
        pixelOffset <= buffer.length // Pixel offset within buffer
      );
    } catch (e) {
      this.logger.error('Error validating BMP structure:', {
        error: e.message,
      });
      return false;
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
      lived_name: record.lived_name,
      remarks: record.remarks,
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

    await csvWriter.writeRecords(syncedData);

    this.logger.log(`Saved ${syncedData.length} synced records to:`);
    this.logger.log(`- JSON: ${jsonFilePath}`);
    this.logger.log(`- CSV: ${csvFilePath}`);
  }

  private async *fetchBatches(
    pool: any,
    hasIsArchivedColumn: boolean,
    batchSize: number,
  ) {
    let offset = 0;
    let batchNumber = 0;
    while (true) {
      batchNumber++;
      const query = hasIsArchivedColumn
        ? `\n            SELECT * FROM ${this.configService.get('SOURCE_DB_TABLE')} \n            WHERE isArchived = 'N' OR isArchived IS NULL\n            ORDER BY ID_Number \n            OFFSET ${offset} ROWS \n            FETCH NEXT ${batchSize} ROWS ONLY\n          `
        : `\n            SELECT * FROM ${this.configService.get('SOURCE_DB_TABLE')} \n            ORDER BY ID_Number \n            OFFSET ${offset} ROWS \n            FETCH NEXT ${batchSize} ROWS ONLY\n          `;
      const result = await pool.request().query(query);
      if (result.recordset.length === 0) break;
      yield { batchRecords: result.recordset, batchNumber };
      offset += batchSize;
    }
  }

  private logMemoryUsage(batchNumber: number) {
    const used = process.memoryUsage();
    this.logger.log(
      `[Batch ${batchNumber}] Memory usage: RSS ${(used.rss / 1024 / 1024).toFixed(2)} MB, Heap ${(used.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    );
  }

  private async cleanupTempFiles(tempDir: string) {
    try {
      if (fs.existsSync(tempDir)) {
        fs.readdirSync(tempDir).forEach((file) => {
          const filePath = path.join(tempDir, file);
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            fs.unlinkSync(filePath);
          } // skip directories
        });
      }
    } catch (e) {
      this.logger.warn('Failed to cleanup temp files:', e);
    }
  }

  private async executeDatabaseSync(jobName: string) {
    if (this.activeJobs.get(jobName)) {
      this.logger.warn(`Sync ${jobName} is already running`);
      return;
    }

    let pool: sql.ConnectionPool | null = null;

    try {
      this.activeJobs.set(jobName, true);
      this.jobStartTimes.set(jobName, new Date());
      this.logger.log(`Starting database sync for ${jobName}`);

      // Add detailed connection logging
      this.logger.log('Attempting SQL Server connection...');
      try {
        pool = await sql.connect(this.sqlConfig);
        this.logger.log('Successfully connected to SQL Server');
      } catch (sqlError) {
        this.logger.error('SQL Connection Error:', {
          message: sqlError.message,
          code: sqlError.code,
          state: sqlError.state,
          serverName: sqlError.serverName,
          procName: sqlError.procName,
          number: sqlError.number,
          class: sqlError.class,
          lineNumber: sqlError.lineNumber,
          stack: sqlError.stack,
        });
        throw new BadRequestException({
          message: 'Failed to connect to SQL Server',
          details: sqlError.message,
          code: sqlError.code,
          state: sqlError.state,
        });
      }

      // 2. Check if isArchived column exists
      const hasIsArchivedColumn = await this.checkColumnExists(
        pool,
        'isArchived',
      );
      this.logger.log(
        `Table ${hasIsArchivedColumn ? 'has' : 'does not have'} isArchived column`,
      );
      const batchSize = parseInt(process.env.SYNC_BATCH_SIZE) || 1000; // default to 1000
      let totalProcessed = 0;
      let totalSkipped = 0;
      let failedRecordsAll = [];
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }
      // Use async generator for batch fetching
      for await (const { batchRecords, batchNumber } of this.fetchBatches(
        pool,
        hasIsArchivedColumn,
        batchSize,
      )) {
        // Convert photos to base64 before adding to batchRecords
        const batchRecordsWithPhoto = await Promise.all(
          batchRecords.map(async (record) => ({
            ...record,
            // Photo: await this.convertPhotoToBase64(
            //   record.Photo,
            //   record.ID_Number,
            // ),
          })),
        );
        // --- Per-batch Postgres sync ---
        // STEP 1: Get all existing students from database in one query
        const existingStudents = await this.studentRepository.find({
          where: {
            ID_Number: In(batchRecordsWithPhoto.map((r) => r.ID_Number)),
          },
        });
        const existingMap = new Map(
          existingStudents.map((s) => [s.ID_Number, s]),
        );
        const toCreate = [];
        const toUpdate = [];
        for (const record of batchRecordsWithPhoto) {
          let uniqueId = record.Unique_ID;
          if (
            typeof uniqueId === 'string' &&
            /^[0-9A-Fa-f\s]+$/.test(uniqueId)
          ) {
            const parsedId = parseInt(uniqueId.replace(/\s/g, ''), 16);
            if (isNaN(parsedId)) {
              this.logger.warn(
                `[Batch ${batchNumber}] Skipping record with invalid Unique_ID (NaN) - ID: ${record.ID_Number}, Unique_ID: ${record.Unique_ID}`,
              );
              totalSkipped++;
              continue;
            }
            uniqueId = parsedId;
          }
          const data = {
            ID_Number: record.ID_Number,
            Name: record.Name,
            Lived_Name: record.Lived_Name,
            Remarks: record.Remarks,
            Photo: '',
            Campus_Entry: record.Campus_Entry,
            Unique_ID: uniqueId,
            isArchived: record.isArchived === 'Y',
            updatedAt: new Date(),
          };
          const existing = existingMap.get(record.ID_Number);
          if (!existing) {
            toCreate.push(data);
          } else if (
            existing.Name !== record.Name ||
            existing.Lived_Name !== record.Lived_Name ||
            existing.Remarks !== record.Remarks ||
            existing.Photo !== record?.Photo ||
            existing.Campus_Entry !== record.Campus_Entry ||
            existing.Unique_ID !== uniqueId ||
            existing.isArchived !== (record.isArchived === 'Y')
          ) {
            toUpdate.push({ ...data, id: existing.id });
          }
        }
        if (toCreate.length) {
          try {
            await this.studentRepository.insert(toCreate);
          } catch (error) {
            this.logger.error(
              `[Batch ${batchNumber}] Batch insert failed. Error: ${error.message}`,
            );

            // If it's a duplicate key error, try to handle it gracefully
            if (
              error.message.includes(
                'duplicate key value violates unique constraint',
              )
            ) {
              this.logger.warn(
                `[Batch ${batchNumber}] Duplicate key error detected. Attempting to update existing records instead.`,
              );

              // For each failed record, try to update it instead
              for (const failedRecord of toCreate) {
                try {
                  const existingRecord = await this.studentRepository.findOne({
                    where: { ID_Number: failedRecord.ID_Number },
                  });

                  if (existingRecord) {
                    // Update the existing record
                    await this.studentRepository.update(
                      { ID_Number: failedRecord.ID_Number },
                      {
                        Name: failedRecord.Name,
                        Lived_Name: failedRecord.Lived_Name,
                        Remarks: failedRecord.Remarks,
                        Photo: failedRecord.Photo,
                        Campus_Entry: failedRecord.Campus_Entry,
                        Unique_ID: failedRecord.Unique_ID,
                        isArchived: failedRecord.isArchived,
                        updatedAt: failedRecord.updatedAt,
                      },
                    );
                    this.logger.log(
                      `[Batch ${batchNumber}] Successfully updated existing record for ID: ${failedRecord.ID_Number}`,
                    );
                  }
                } catch (updateError) {
                  this.logger.error(
                    `[Batch ${batchNumber}] Failed to update record for ID: ${failedRecord.ID_Number}. Error: ${updateError.message}`,
                  );
                  failedRecordsAll.push({
                    batchNumber,
                    error: 'Failed to update existing record',
                    details: updateError.message,
                    failedRecords: [
                      {
                        ID_Number: failedRecord.ID_Number,
                        Name: failedRecord.Name,
                      },
                    ],
                  });
                }
              }
            } else {
              // Log the failed records for debugging
              failedRecordsAll.push({
                batchNumber,
                error: 'Database insert failed',
                details: error.message,
                failedRecords: toCreate.map((r) => ({
                  ID_Number: r.ID_Number,
                  Name: r.Name,
                })),
              });
            }
          }
        }
        if (toUpdate.length) {
          try {
            await this.studentRepository.save(toUpdate);
          } catch (error) {
            this.logger.error(
              `[Batch ${batchNumber}] Batch update failed. Error: ${error.message}`,
            );
            // Log the failed records for debugging
            failedRecordsAll.push({
              batchNumber,
              error: 'Database update failed',
              details: error.message,
              failedRecords: toUpdate.map((r) => ({
                ID_Number: r.ID_Number,
                Name: r.Name,
              })),
            });
          }
        }
        this.logger.log(
          `[Batch ${batchNumber}] Synced ${toCreate.length + toUpdate.length} records (${batchRecordsWithPhoto.length - (toCreate.length + toUpdate.length)} unchanged)`,
        );

        // --- Per-batch CSV/Import/FaceTemplate ---
        const csvFilePath = path.join(
          tempDir,
          `sync_${jobName}_batch${batchNumber}_${Date.now()}.csv`,
        );
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
        const skippedRecords = [];
        dayjs.extend(utc);
        dayjs.extend(timezone);
        const currentDate = dayjs().tz('Asia/Manila').startOf('day');
        const startDate = currentDate.subtract(10, 'year');
        const formattedStartDate = startDate.format('YYYY-MM-DD HH:mm:ss.SSS');
        const expiryDateEnabled = currentDate.add(1, 'year');
        const formattedExpiryDateEnabled = expiryDateEnabled.format(
          'YYYY-MM-DD HH:mm:ss.SSS',
        );
        const expiryDateDisabled = currentDate.subtract(1, 'day');
        const formattedExpiryDateDisabled = expiryDateDisabled.format(
          'YYYY-MM-DD HH:mm:ss.SSS',
        );
        const formattedRecords = (
          await Promise.all(
            batchRecordsWithPhoto.map(async (record) => {
              const userId = this.sanitizeUserId(
                record.Unique_ID !== null && record.Unique_ID !== undefined
                  ? record.Unique_ID?.toString()?.trim()
                  : record.ID_Number?.toString()?.trim() || '',
              );
              const name = this.removeSpecialChars(record.Name?.trim() || '');
              const livedName = record.Lived_Name?.trim() || '';
              const remarks = record.Remarks?.trim() || '';
              const validationErrors = [];
              if (!userId) {
                validationErrors.push('Invalid hex conversion');
                failedRecordsAll.push({
                  ID_Number: record.ID_Number,
                  userId:
                    record.Unique_ID?.toString()?.trim() ||
                    record.ID_Number?.toString()?.trim() ||
                    '',
                  name,
                  livedName,
                  remarks,
                  reason: 'Invalid hex conversion',
                  timestamp: new Date().toISOString(),
                });
                this.logger.warn(
                  `[Batch ${batchNumber}] Skipping record with invalid hex conversion - ID: ${record.ID_Number}`,
                );
                return null;
              }
              if (userId.length > 10) {
                validationErrors.push('ID too long');
              }
              if (!name) {
                validationErrors.push('Empty name');
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
                  `[Batch ${batchNumber}] Skipping record with validation errors - ID: ${record.ID_Number}, Errors: ${validationErrors.join(', ')}`,
                );
                return null;
              }

              // --- BioStar 2 Visual Face CSV Import Extension ---
              // Save face images as files and reference them in CSV
              // const faceImageBase64 = await this.convertPhotoToBase64(
              //   record.Photo,
              //   record.ID_Number,
              // );
              // let faceImageFile1 = '';
              // let faceImageFile2 = '';
              // if (faceImageBase64) {
              //   // Write two image files per user (for demo, use same image for both)
              //   const fileName1 = `${userId}_1.jpg`;
              //   const fileName2 = `${userId}_2.jpg`;
              //   const filePath1 = path.join(tempDir, fileName1);
              //   const filePath2 = path.join(tempDir, fileName2);
              //   fs.writeFileSync(
              //     filePath1,
              //     Buffer.from(faceImageBase64, 'base64'),
              //   );
              //   fs.writeFileSync(
              //     filePath2,
              //     Buffer.from(faceImageBase64, 'base64'),
              //   );
              //   faceImageFile1 = fileName1;
              //   faceImageFile2 = fileName2;
              // }

              return {
                user_id: record.ID_Number,
                name: name,
                department: 'DLSU',
                user_title: 'Student',
                phone: '',
                email: '',
                user_group: 'All Users',
                lived_name: livedName,
                remarks: remarks,
                csn: userId,
                // photo: faceImageBase64, // retain photo value for API
                // face_image_file1: faceImageFile1, // reference image file
                // face_image_file2: faceImageFile2, // reference image file
                photo: '', // retain photo value for API
                face_image_file1: '', // reference image file
                face_image_file2: '', // reference image file
                start_datetime: formattedStartDate,
                expiry_datetime:
                  record.Campus_Entry.toString().toUpperCase() === 'N'
                    ? formattedExpiryDateDisabled
                    : formattedExpiryDateEnabled,
                original_campus_entry: record.Campus_Entry,
              };
            }),
          )
        ).filter((record) => record !== null);

        if (formattedRecords.length === 0) {
          this.logger.log(
            `[Batch ${batchNumber}] No valid records after filtering. Skipping CSV generation and upload for this batch.`,
          );
          continue;
        }

        await csvWriter.writeRecords(formattedRecords);
        this.logger.log(
          `[Batch ${batchNumber}] CSV file created at ${csvFilePath}`,
        );
        // Ensure the CSV file exists and is fully written before upload
        let csvFileReady = false;
        for (let i = 0; i < 10; i++) {
          // Try for up to ~2 seconds
          try {
            await fs.promises.access(
              csvFilePath,
              fs.constants.F_OK | fs.constants.R_OK,
            );
            const stats = await fs.promises.stat(csvFilePath);
            if (stats.size > 0) {
              csvFileReady = true;
              break;
            }
          } catch (e) {
            this.logger.warn(
              `[Batch ${batchNumber}] CSV file not ready yet, retrying...`,
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        if (!csvFileReady) {
          this.logger.error(
            `[Batch ${batchNumber}] CSV file was not created or is empty. Aborting upload for this batch.`,
          );
          failedRecordsAll.push({
            batchNumber,
            error: 'CSV file not created or empty',
            details: `File: ${csvFilePath}`,
          });
          // Write failed record log immediately
          const failedFile = path.join(
            this.logDir,
            `failed_batch_${jobName}_${batchNumber}_${Date.now()}.json`,
          );
          fs.writeFileSync(
            failedFile,
            JSON.stringify(failedRecordsAll, null, 2),
          );
          this.logger.log(
            `[Batch ${batchNumber}] Failed records written to ${failedFile}`,
          );
          continue; // Skip this batch
        }
        // After successful CSV upload and before cleanup
        await this.logSyncedRecords(formattedRecords, jobName);
        // 6. Upload to API with retries (per batch)
        let retries = 3;
        while (retries > 0) {
          try {
            const { token, sessionId } = await this.getApiToken();
            // Step 1: Upload the CSV file to /api/attachments
            const uploadFormData = new FormData();
            uploadFormData.append('file', fs.createReadStream(csvFilePath));
            this.logger.log(
              `[Batch ${batchNumber}] Uploading CSV file to attachments...`,
            );
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
                timeout: 120000,
                httpsAgent: new https.Agent({
                  rejectUnauthorized: false,
                }),
              },
            );
            if (!uploadResponse.data?.filename) {
              throw new Error('Failed to get filename from upload response');
            }
            const uploadedFileName = uploadResponse.data.filename;
            this.logger.log(
              `[Batch ${batchNumber}] File uploaded successfully as: ${uploadedFileName}`,
            );
            // Step 2: Import the uploaded CSV
            const firstLine = fs
              .readFileSync(csvFilePath, 'utf8')
              .split('\n')[0];
            const headers = firstLine.split(',');
            // Read the CSV file to get face template data
            // const csvData = fs
            //   .readFileSync(csvFilePath, 'utf8')
            //   .split('\n')
            //   .slice(1);
            // const faceTemplateData = new Map();
            // for (const line of csvData) {
            //   if (!line.trim()) continue;
            //   const values = line.split(',');
            //   const userId = values[0];
            //   const faceImage1 = values[11];
            //   const faceImage2 = values[12];
            //   if (faceImage1 && faceImage1.includes('|')) {
            //     const [, templateFile] = faceImage1.split('|');
            //     const templatePath = path.join(tempDir, templateFile);
            //     if (fs.existsSync(templatePath)) {
            //       const templateData = JSON.parse(
            //         fs.readFileSync(templatePath, 'utf8'),
            //       );
            //       faceTemplateData.set(`${userId}_1`, templateData);
            //     }
            //   }
            //   if (faceImage2 && faceImage2.includes('|')) {
            //     const [, templateFile] = faceImage2.split('|');
            //     const templatePath = path.join(tempDir, templateFile);
            //     if (fs.existsSync(templatePath)) {
            //       const templateData = JSON.parse(
            //         fs.readFileSync(templatePath, 'utf8'),
            //       );
            //       faceTemplateData.set(`${userId}_2`, templateData);
            //     }
            //   }
            // }
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
            this.logger.log(`[Batch ${batchNumber}] Importing CSV file...`);
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
              if (importResponse.data.CsvRowCollection) {
                const failedRows = importResponse.data.CsvRowCollection.rows;

                if (importResponse.data.File?.uri) {
                  const errorFileUri = importResponse.data.File.uri;
                  this.logger.warn(
                    `[Batch ${batchNumber}] Error details file generated: ${errorFileUri}`,
                  );

                  // Download the error details file
                  try {
                    const errorFilePath = path.join(
                      this.logDir,
                      `error_details_batch_${jobName}_${batchNumber}_${Date.now()}.csv`,
                    );

                    // Make a GET request to download the error file
                    const downloadResponse = await axios.get(
                      `${this.apiBaseUrl}/download/${errorFileUri}`,
                      {
                        headers: {
                          Authorization: `Bearer ${token}`,
                          'bs-session-id': sessionId,
                        },
                        responseType: 'stream',
                        httpsAgent: new https.Agent({
                          rejectUnauthorized: false,
                        }),
                      },
                    );

                    // Save the file to disk
                    const writer = fs.createWriteStream(errorFilePath);
                    downloadResponse.data.pipe(writer);

                    await new Promise((resolve, reject) => {
                      writer.on('finish', resolve);
                      writer.on('error', reject);
                    });

                    this.logger.log(
                      `[Batch ${batchNumber}] Error details file downloaded to ${errorFilePath}`,
                    );

                    // Add the downloaded file path to the failed records
                    failedRecordsAll.push({
                      batchNumber,
                      error: `Partial import: ${failedRows.length} rows failed`,
                      failedRows,
                      importResponse: importResponse.data,
                      errorDetailsFilePath: errorFilePath,
                    });
                  } catch (downloadError) {
                    this.logger.error(
                      `[Batch ${batchNumber}] Failed to download error details file: ${downloadError.message}`,
                    );

                    failedRecordsAll.push({
                      batchNumber,
                      error: `Partial import: ${failedRows.length} rows failed`,
                      failedRows,
                      importResponse: importResponse.data,
                      downloadError: downloadError.message,
                    });
                  }
                } else {
                  // No error details file was generated
                  failedRecordsAll.push({
                    batchNumber,
                    error: `Partial import: ${failedRows.length} rows failed`,
                    failedRows,
                    importResponse: importResponse.data,
                  });
                }
                break; // Continue to next batch
              }
            } else if (importResponse.data?.Response?.code !== '0') {
              this.logger.log(
                `[Batch ${batchNumber}] CSV import successful - All ${formattedRecords.length} records processed`,
              );
              // for (const [key, templateData] of faceTemplateData.entries()) {
              //   const [userId, templateNumber] = key.split('_');
              //   try {
              //     const updateResponse = await axios.put(
              //       `${this.apiBaseUrl}/api/users/${userId}`,
              //       {
              //         User: {
              //           credentials: {
              //             visualFaces: [
              //               {
              //                 template_ex_normalized_image:
              //                   templateData.normalizedImage,
              //                 templates: [
              //                   {
              //                     credential_bin_type: '9',
              //                     template_ex: templateData.template,
              //                   },
              //                 ],
              //               },
              //             ],
              //           },
              //         },
              //       },
              //       {
              //         headers: {
              //           'Content-Type': 'application/json',
              //           Authorization: `Bearer ${token}`,
              //           'bs-session-id': sessionId,
              //         },
              //         httpsAgent: new https.Agent({
              //           rejectUnauthorized: false,
              //         }),
              //       },
              //     );
              //     if (updateResponse.data?.Response?.code !== '0') {
              //       this.logger.warn(
              //         `[Batch ${batchNumber}] Failed to update face template for user ${userId}, template ${templateNumber}:`,
              //         updateResponse.data?.Response?.message,
              //       );
              //     } else {
              //       this.logger.log(
              //         `[Batch ${batchNumber}] Successfully updated face template for user ${userId}, template ${templateNumber}`,
              //       );
              //     }
              //   } catch (error) {
              //     this.logger.error(
              //       `[Batch ${batchNumber}] Error updating face template for user ${userId}, template ${templateNumber}:`,
              //       error.message,
              //     );
              //   }
              // }
            }
            this.logger.log(
              `[Batch ${batchNumber}] CSV file uploaded successfully`,
            );
            break;
          } catch (error) {
            retries--;
            const errorMessage = axios.isAxiosError(error)
              ? `API Error: ${error.response?.status} - ${error.response?.data?.message || error.message}`
              : `Upload Error: ${error.message}`;
            if (retries === 0) {
              this.logger.warn(
                `[Batch ${batchNumber}] Final upload attempt failed: ${errorMessage}`,
              );
              failedRecordsAll.push({
                batchNumber,
                error: 'CSV upload failed after all retries',
                details: errorMessage,
              });
              break; // Continue to next batch, do not throw
            }
            this.logger.warn(
              `[Batch ${batchNumber}] Upload attempt failed (${retries} retries left): ${errorMessage}`,
            );
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        }
        // Write skipped records to disk per batch (not in memory)
        if (skippedRecords.length > 0) {
          const skippedFile = path.join(
            this.logDir,
            `skipped_batch_${jobName}_${batchNumber}_${Date.now()}.json`,
          );
          fs.writeFileSync(
            skippedFile,
            JSON.stringify(skippedRecords, null, 2),
          );
          this.logger.log(
            `[Batch ${batchNumber}] Skipped records written to ${skippedFile}`,
          );
        }
        // Write failed records to disk per batch (not in memory)
        if (failedRecordsAll.length > 0) {
          const failedFile = path.join(
            this.logDir,
            `failed_batch_${jobName}_${batchNumber}_${Date.now()}.json`,
          );
          fs.writeFileSync(
            failedFile,
            JSON.stringify(failedRecordsAll, null, 2),
          );
          this.logger.log(
            `[Batch ${batchNumber}] Failed records written to ${failedFile}`,
          );
        }
        // Tally for summary (counters only)
        totalProcessed += formattedRecords.length;
        totalSkipped += skippedRecords.length;
        // Explicitly nullify large objects and arrays
        batchRecords.length = 0;
        batchRecordsWithPhoto.length = 0;
        skippedRecords.length = 0;
        failedRecordsAll.length = 0;
        // Remove references to formattedRecords
        for (let i = 0; i < formattedRecords.length; i++) {
          formattedRecords[i] = null;
        }
        // Clean up temp files and force GC after each batch
        this.logMemoryUsage(batchNumber);
        // Only cleanup temp files after logs and uploads are complete
        // (Moved cleanupTempFiles here, after all logs and uploads)
        await this.cleanupTempFiles(tempDir);
        if (global.gc) {
          global.gc();
        }
      }

      // Final cleanup after all batches are complete
      this.logger.log('All batches processed, performing final cleanup...');
      await this.cleanupTempFiles(tempDir);

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
        recordsProcessed: totalProcessed,
      };
    } catch (error) {
      this.logger.error(`Sync failed for ${jobName}:`, error);
      throw error;
    } finally {
      // Cleanup
      if (pool) {
        await pool.close();
        this.logger.log('Database connection closed');
      }
      this.activeJobs.set(jobName, false);
      this.jobStartTimes.delete(jobName);
    }
  }

  async triggerManualSync() {
    try {
      // Add the sync job to the queue
      const { queueId, position } =
        await this.databaseSyncQueueService.addToQueue();

      // Start processing the queue if not already running
      this.processQueue();

      return {
        success: true,
        message: 'Sync job added to queue',
        queueId,
        position,
      };
    } catch (error) {
      this.logger.error('Failed to add sync job to queue:', error);
      throw new BadRequestException({
        message: 'Failed to add sync job to queue',
        details: error.message,
      });
    }
  }

  private async processQueue() {
    // Check if queue processor is already running
    if (this.activeJobs.get('queue-processor')) {
      this.logger.debug('Queue processor is already running');
      return;
    }

    // Mark queue processor as active
    this.activeJobs.set('queue-processor', true);

    try {
      // Process all pending jobs in the queue
      await this.processNextQueueItem();
    } catch (error) {
      this.logger.error('Error processing queue:', error);
    } finally {
      // Mark queue processor as inactive
      this.activeJobs.set('queue-processor', false);
    }
  }

  private async processNextQueueItem() {
    // Find the next pending job in the queue
    const pendingJob = await this.databaseSyncQueueService.findNextPendingJob();

    if (!pendingJob) {
      this.logger.debug('No pending jobs in queue');
      return;
    }

    // Update job status to processing
    await this.databaseSyncQueueService.updateQueueStatus(
      pendingJob.id,
      'processing',
    );

    try {
      // Generate a unique job name
      const jobName = `manual-${pendingJob.id}`;

      // Execute the sync job
      await this.executeDatabaseSync(jobName);

      // Update job status to completed
      await this.databaseSyncQueueService.updateQueueStatus(
        pendingJob.id,
        'completed',
      );

      // Process next item in queue
      await this.processNextQueueItem();
    } catch (error) {
      // Update job status to failed
      await this.databaseSyncQueueService.updateQueueStatus(
        pendingJob.id,
        'failed',
      );

      this.logger.error(`Sync job ${pendingJob.id} failed:`, error);

      // Process next item in queue
      await this.processNextQueueItem();
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
        ? `SELECT TOP 1 * FROM ${this.configService.get('SOURCE_DB_TABLE')} WHERE isArchived = 0 ORDER BY ID_Number`
        : `SELECT TOP 1 * FROM ${this.configService.get('SOURCE_DB_TABLE')} ORDER BY ID_Number`;
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
        .set({ isArchived: () => "'true'" })
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
            .set({ isArchived: () => "'false'" })
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

  private async extractFaceTemplate(
    base64Image: string,
    studentId: string,
  ): Promise<{ template: string; normalizedImage: string } | null> {
    try {
      const { token, sessionId } = await this.getApiToken();

      // Step 1: Detect face and retrieve template from image
      const response = await axios.put(
        `${this.apiBaseUrl}/api/users/check/upload_picture`,
        {
          template_ex_picture: base64Image,
        },
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

      if (response.data?.Response?.code !== '0') {
        this.logger.error('Failed to extract face template:', {
          studentId,
          error: response.data?.Response?.message,
        });
        return null;
      }

      // For BioStar 2.9.7 and above
      if (response.data?.image_template_2) {
        return {
          template: response.data.image_template_2,
          normalizedImage: response.data.image,
        };
      }
      // For BioStar 2.9.1 to 2.9.6
      else if (response.data?.image_template) {
        return {
          template: response.data.image_template,
          normalizedImage: response.data.image,
        };
      }
      // For BioStar 2.9.0 and below
      else {
        return {
          template: response.data.image,
          normalizedImage: response.data.image,
        };
      }
    } catch (error) {
      this.logger.error('Error extracting face template:', {
        error: error.message,
        studentId,
      });
      return null;
    }
  }

  private async processFaceImage(
    base64Data: string,
    studentId: string,
    imageNumber: number,
    csvDir: string,
  ): Promise<string> {
    try {
      // Input validation
      if (!base64Data) {
        this.logger.warn(
          `[Student ${studentId}] No image data provided for face image ${imageNumber}`,
        );
        return '';
      }

      // Create file paths
      const fileName = `${studentId}_face_${imageNumber}.jpg`;
      const filePath = path.join(csvDir, fileName);

      // Validate base64 format
      if (!this.isValidBase64(base64Data)) {
        this.logger.error(
          `[Student ${studentId}] Invalid base64 format for face image ${imageNumber}`,
          {
            dataLength: base64Data.length,
            sampleData: base64Data.substring(0, 50) + '...',
          },
        );
        return '';
      }

      // Convert base64 to buffer with detailed logging
      let imageBuffer: Buffer;
      try {
        imageBuffer = Buffer.from(base64Data, 'base64');
        this.logger.debug(
          `[Student ${studentId}] Successfully converted base64 to buffer`,
          {
            bufferLength: imageBuffer.length,
            bufferSample: imageBuffer.slice(0, 16).toString('hex'),
          },
        );
      } catch (bufferError) {
        this.logger.error(
          `[Student ${studentId}] Failed to convert base64 to buffer`,
          {
            error: bufferError.message,
            dataLength: base64Data.length,
          },
        );
        return '';
      }

      // Detect image format
      const imageFormat = await this.detectImageFormat(imageBuffer);

      // If it's a BMP, fix byte order first then convert
      if (imageFormat.format === 'BMP') {
        try {
          // Fix BMP byte order if needed
          const fixedBmpBuffer = this.fixBmpByteOrder(imageBuffer);
          if (fixedBmpBuffer) {
            this.logger.debug(`[Student ${studentId}] Fixed BMP byte order`, {
              originalSize: imageBuffer.length,
              fixedSize: fixedBmpBuffer.length,
            });
            imageBuffer = fixedBmpBuffer;
          }

          // Extract raw pixel data from BMP
          const { width, height, pixels } = this.extractBmpPixels(imageBuffer);

          // Create raw RGB buffer that Sharp can handle
          this.logger.debug(
            `[Student ${studentId}] Converting BMP to raw format`,
            {
              width,
              height,
              pixelCount: pixels.length / 3,
            },
          );

          // Convert to raw pixels then to Sharp
          const convertedBuffer = await sharp(pixels, {
            raw: {
              width,
              height,
              channels: 3,
            },
          })
            .jpeg()
            .toBuffer();

          imageBuffer = convertedBuffer;
          this.logger.debug(
            `[Student ${studentId}] Successfully converted BMP`,
            {
              originalSize: imageBuffer.length,
              newSize: convertedBuffer.length,
            },
          );
        } catch (conversionError) {
          this.logger.error(`[Student ${studentId}] Failed to convert BMP`, {
            error: conversionError.message,
            originalFormat: imageFormat.format,
          });
          return '';
        }
      }

      if (!imageFormat.valid) {
        this.logger.error(
          `[Student ${studentId}] Unsupported or invalid image format`,
          {
            detectedFormat: imageFormat.format,
            signature: imageBuffer.slice(0, 8).toString('hex'),
            error: imageFormat.error,
          },
        );
        return '';
      }

      this.logger.debug(`[Student ${studentId}] Processing image`, {
        format: imageFormat.format,
        originalSize: imageBuffer.length,
      });

      // Process image with Sharp with enhanced error handling
      let processedImage;
      try {
        processedImage = await sharp(imageBuffer, {
          failOnError: true,
          pages: 1,
        })
          .resize(250, 250, {
            fit: 'cover',
            position: 'center',
          })
          .jpeg({
            quality: 90,
            mozjpeg: true,
          });
      } catch (sharpError) {
        this.logger.error(`[Student ${studentId}] Sharp processing failed`, {
          error: sharpError.message,
          code: sharpError.code,
          nativeError: sharpError.nativeError,
          format: imageFormat.format,
        });
        return '';
      }

      // Get and validate image metadata
      const metadata = await processedImage.metadata();
      this.logger.debug(`[Student ${studentId}] Image metadata`, {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: metadata.size,
      });

      // Size validation
      if (metadata.width < 250 || metadata.height < 250) {
        this.logger.error(`[Student ${studentId}] Image dimensions too small`, {
          width: metadata.width,
          height: metadata.height,
          minimumRequired: '250x250',
        });
        return '';
      }

      // Process final image with size optimization
      try {
        if (metadata.size > 10 * 1024 * 1024) {
          this.logger.warn(
            `[Student ${studentId}] Large image detected, reducing quality`,
            {
              originalSize: `${(metadata.size / 1024 / 1024).toFixed(2)}MB`,
            },
          );
          await processedImage.jpeg({ quality: 70 }).toFile(filePath);
        } else {
          await processedImage.toFile(filePath);
        }
      } catch (saveError) {
        this.logger.error(
          `[Student ${studentId}] Failed to save processed image`,
          {
            error: saveError.message,
            path: filePath,
          },
        );
        return '';
      }

      // Extract face template
      try {
        const processedBase64 = fs.readFileSync(filePath).toString('base64');
        const templateData = await this.extractFaceTemplate(
          processedBase64,
          studentId,
        );

        if (!templateData) {
          this.logger.warn(
            `[Student ${studentId}] Failed to extract face template for image ${imageNumber}`,
          );
          return '';
        }

        // Save template data
        const templateFileName = `${studentId}_face_${imageNumber}_template.json`;
        const templateFilePath = path.join(csvDir, templateFileName);
        fs.writeFileSync(
          templateFilePath,
          JSON.stringify({
            template: templateData.template,
            normalizedImage: templateData.normalizedImage,
          }),
        );

        this.logger.log(
          `[Student ${studentId}] Successfully processed face image`,
          {
            dimensions: `${metadata.width}x${metadata.height}`,
            size: `${(metadata.size / 1024 / 1024).toFixed(2)}MB`,
            format: metadata.format,
          },
        );

        return `${fileName}|${templateFileName}`;
      } catch (templateError) {
        this.logger.error(
          `[Student ${studentId}] Face template extraction failed`,
          {
            error: templateError.message,
            imageNumber,
          },
        );
        return '';
      }
    } catch (error) {
      this.logger.error(
        `[Student ${studentId}] Critical error in processFaceImage`,
        {
          error: error.message,
          stack: error.stack,
          imageNumber,
        },
      );
      return '';
    }
  }

  private fixBmpByteOrder(buffer: Buffer): Buffer | null {
    try {
      // Check if it's a BMP file
      if (buffer.length < 54 || buffer.toString('ascii', 0, 2) !== 'BM') {
        return null;
      }

      // Read the size fields
      const fileSize = buffer.readUInt32LE(2);
      const pixelOffset = buffer.readUInt32LE(10);
      const headerSize = buffer.readUInt32LE(14);

      // Check if size fields need fixing
      if (
        fileSize === buffer.length &&
        pixelOffset >= 54 &&
        pixelOffset < fileSize &&
        [12, 40, 52, 56, 108, 124].includes(headerSize)
      ) {
        // BMP structure looks valid, no fix needed
        return buffer;
      }

      // Try fixing byte order
      const newBuffer = Buffer.alloc(buffer.length);
      buffer.copy(newBuffer); // Copy original data

      // Swap byte order for size field if it looks wrong
      const swappedSize =
        ((fileSize & 0xff) << 24) |
        ((fileSize & 0xff00) << 8) |
        ((fileSize & 0xff0000) >> 8) |
        ((fileSize & 0xff000000) >> 24);

      if (swappedSize <= buffer.length && swappedSize >= 54) {
        newBuffer.writeUInt32LE(swappedSize, 2);
        return newBuffer;
      }

      return buffer; // Return original if swap doesn't help
    } catch (error) {
      this.logger.error('Failed to fix BMP byte order:', error);
      return null;
    }
  }

  private isValidBase64(str: string): boolean {
    try {
      // Check if string matches base64 pattern
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(str)) {
        return false;
      }
      // Check if length is valid (must be multiple of 4)
      if (str.length % 4 !== 0) {
        return false;
      }
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  private async detectImageFormat(
    buffer: Buffer,
  ): Promise<{ valid: boolean; format?: string; error?: string }> {
    try {
      // Check common image format signatures
      const signatures = {
        ffd8ff: 'JPEG',
        '89504e47': 'PNG',
        '47494638': 'GIF',
        '424d': 'BMP',
      };

      const signature = buffer.slice(0, 4).toString('hex');

      for (const [sig, format] of Object.entries(signatures)) {
        if (signature.startsWith(sig)) {
          return { valid: true, format };
        }
      }

      // Additional check for JPEG variations
      if (signature.startsWith('ffd8')) {
        return { valid: true, format: 'JPEG' };
      }

      return {
        valid: false,
        error: 'Unrecognized image format',
        format: `Unknown (signature: ${signature})`,
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        format: 'Error detecting format',
      };
    }
  }

  private extractBmpPixels(buffer: Buffer): {
    width: number;
    height: number;
    pixels: Buffer;
  } {
    // Read BMP header
    const width = buffer.readInt32LE(18);
    const height = Math.abs(buffer.readInt32LE(22));
    const bitsPerPixel = buffer.readUInt16LE(28);
    const compression = buffer.readUInt32LE(30);
    const dataOffset = buffer.readUInt32LE(10);

    if (compression !== 0 || bitsPerPixel !== 24) {
      throw new Error(
        `Unsupported BMP format: ${bitsPerPixel}bpp, compression ${compression}`,
      );
    }

    // Calculate row size (must be multiple of 4 bytes)
    const rowSize = Math.floor((width * bitsPerPixel + 31) / 32) * 4;
    const pixelCount = width * height;
    const pixels = Buffer.alloc(pixelCount * 3); // RGB format

    // Extract pixels (BMP stores them bottom-to-top by default)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const bmpOffset = dataOffset + (height - 1 - y) * rowSize + x * 3;
        const rgbOffset = (y * width + x) * 3;

        // BMP stores in BGR, we need RGB
        pixels[rgbOffset] = buffer[bmpOffset + 2]; // R
        pixels[rgbOffset + 1] = buffer[bmpOffset + 1]; // G
        pixels[rgbOffset + 2] = buffer[bmpOffset]; // B
      }
    }

    return { width, height, pixels };
  }
}
