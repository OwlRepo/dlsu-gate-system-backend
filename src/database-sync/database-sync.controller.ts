import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  Get,
} from '@nestjs/common';
import { DatabaseSyncService } from './database-sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Role } from '../auth/enums/role.enum';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduledSyncDto } from './dto/scheduled-sync.dto';

@ApiTags('Database Sync')
@ApiBearerAuth()
@Controller('database-sync')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class DatabaseSyncController {
  constructor(private readonly databaseSyncService: DatabaseSyncService) {}

  @Post('schedule')
  @ApiOperation({
    summary: 'Update sync schedule',
    description: `
      Updates when the automatic database sync should run.
      
      - Allows setting two daily sync schedules (schedule 1 and 2)
      - Time must be in 24-hour format (HH:mm)
      - Example: "09:00" for 9 AM, "21:00" for 9 PM
      - Only admins can update schedules
      
      This sync process:
      1. Pulls non-archived students from SQL Server
      2. Syncs records to local PostgreSQL database
      3. Converts data to CSV format
      4. Uploads to BIOSTAR API
    `,
  })
  @ApiBody({ type: UpdateScheduleDto })
  @ApiResponse({ status: 200, description: 'Schedule successfully updated' })
  @ApiResponse({ status: 400, description: 'Invalid military time format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async updateSchedule(@Body() payload: UpdateScheduleDto) {
    const { scheduleNumber, time } = payload;

    // Validate military time format
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(time)) {
      throw new BadRequestException(
        'Invalid military time format. Use HH:mm (00:00-23:59)',
      );
    }

    return this.databaseSyncService.updateSchedule(scheduleNumber, time);
  }

  @Post('sync')
  @ApiOperation({
    summary: 'Trigger manual sync',
    description: `
      Starts an immediate database sync without waiting for schedule.
      
      The sync process:
      1. Connects to SQL Server
      2. Fetches all non-archived student records
      3. Syncs records to local PostgreSQL database
      4. Converts data to CSV format
      5. Uploads to BIOSTAR API
      
      - Only admins can trigger manual sync
      - Returns a queue ID to track the sync job
      - Includes automatic retries on failure
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Sync job successfully started',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Manual sync completed',
        },
        queueId: {
          type: 'string',
          example: '12345678-1234-1234-1234-123456789012',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async triggerManualSync() {
    return this.databaseSyncService.triggerManualSync();
  }

  @Get('schedules')
  @ApiOperation({
    summary: 'Get all scheduled syncs',
    description: `
      Returns information about all configured sync schedules.
      
      Returns for each schedule:
      - Schedule number (1 or 2)
      - Configured time
      - Whether it's currently active
      - Last successful sync time
      - Next scheduled run time
      
      Only admins can view schedules.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'List of all scheduled syncs',
    type: [ScheduledSyncDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async getSchedules() {
    return this.databaseSyncService.getAllSchedules();
  }

  @Get('test-connection')
  @ApiOperation({
    summary: 'Test SQL Server connection',
    description:
      'Tests the connection to SQL Server and returns sample data if successful',
  })
  @ApiResponse({
    status: 200,
    description: 'Connection successful',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        sampleData: { type: 'object' },
      },
    },
  })
  async testConnection() {
    return this.databaseSyncService.testConnection();
  }
}
