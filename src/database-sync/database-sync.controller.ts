import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  Delete,
  Get,
  Param,
} from '@nestjs/common';
import { DatabaseSyncService } from './database-sync.service';
import { DatabaseSyncQueueService } from './database-sync-queue.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
  ApiProperty,
} from '@nestjs/swagger';
import { Role } from 'src/auth/enums/role.enum';

// Define DTO for schedule update
class UpdateScheduleDto {
  @ApiProperty({
    description: 'Schedule number identifier',
    example: 1,
    type: Number,
    minimum: 1,
    maximum: 10,
  })
  scheduleNumber: number;

  @ApiProperty({
    description: 'Time in 24-hour format (HH:mm)',
    example: '14:30',
    pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$',
    examples: {
      morning: {
        value: '09:00',
        description: 'Morning sync',
      },
      afternoon: {
        value: '14:30',
        description: 'Afternoon sync',
      },
      evening: {
        value: '20:00',
        description: 'Evening sync',
      },
    },
  })
  time: string;
}

class ScheduledSyncDto {
  @ApiProperty({
    description: 'Schedule identifier',
    example: 1,
  })
  scheduleNumber: number;

  @ApiProperty({
    description: 'Scheduled time in 24-hour format',
    example: '14:30',
  })
  time: string;

  @ApiProperty({
    description: 'Whether this schedule is currently active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Last successful sync time',
    example: '2024-03-20T14:30:00Z',
    nullable: true,
  })
  lastSyncTime: Date | null;
}

class JenkinsJobStatusDto {
  @ApiProperty({
    description: 'Name of the Jenkins job',
    example: 'Scheduled Sync 1',
  })
  jobName: string;

  @ApiProperty({
    description: 'Whether the job is currently running',
    example: true,
  })
  isRunning: boolean;

  @ApiProperty({
    description: 'Status of the last build',
    example: 'SUCCESS',
    nullable: true,
  })
  lastBuildStatus: string | null;

  @ApiProperty({
    description: 'Timestamp of the last build',
    example: '2024-03-20T14:30:00Z',
    nullable: true,
  })
  lastBuildTime: Date | null;

  @ApiProperty({
    description: 'Next scheduled run time',
    example: '2024-03-20T18:00:00Z',
    nullable: true,
  })
  nextScheduledRun: Date | null;
}

@ApiTags('Database Sync')
@ApiBearerAuth()
@Controller('database-sync')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class DatabaseSyncController {
  constructor(
    private readonly databaseSyncService: DatabaseSyncService,
    private readonly queueService: DatabaseSyncQueueService,
  ) {}

  @Post('schedule')
  @ApiOperation({
    summary: 'Update sync schedule',
    description:
      'Updates the database sync schedule time. Requires admin privileges.',
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
    description:
      'Triggers an immediate database sync. Requires admin privileges. Limited to 4 concurrent queued syncs.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sync job successfully queued',
    schema: {
      type: 'object',
      properties: {
        queueId: {
          type: 'string',
          example: '12345678-1234-1234-1234-123456789012',
        },
        position: {
          type: 'number',
          example: 1,
          description: 'Position in queue (1-4)',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Queue is full - maximum 4 pending syncs allowed',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async triggerManualSync() {
    return this.queueService.addToQueue();
  }

  @Delete('queue/:queueId')
  @ApiOperation({
    summary: 'Delete pending sync',
    description:
      'Removes a pending sync from the queue. Cannot cancel already running syncs. Requires admin privileges.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sync job successfully removed from queue',
  })
  @ApiResponse({ status: 404, description: 'Queue item not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete - sync is already in progress',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async removePendingSync(@Param('queueId') queueId: string) {
    return this.queueService.removeFromQueue(queueId);
  }

  @Get('schedules')
  @ApiOperation({
    summary: 'Get all scheduled syncs',
    description:
      'Retrieves all configured database sync schedules. Requires admin privileges.',
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

  @Get('jobs/status')
  @ApiOperation({
    summary: 'Get Jenkins jobs status',
    description:
      'Retrieves the status of all database sync Jenkins jobs (scheduled and manual).',
  })
  @ApiResponse({
    status: 200,
    description: 'List of Jenkins jobs status',
    type: [JenkinsJobStatusDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async getJenkinsJobsStatus() {
    return this.databaseSyncService.getJenkinsJobsStatus();
  }
}
