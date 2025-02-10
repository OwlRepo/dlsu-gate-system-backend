import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncSchedule } from './entities/sync-schedule.entity';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ScheduledSyncDto } from './dto/scheduled-sync.dto';

export interface JenkinsJobStatus {
  jobName: string;
  isRunning: boolean;
  lastBuildStatus: string | null;
  lastBuildTime: Date | null;
  nextScheduledRun: Date | null;
}

@Injectable()
export class DatabaseSyncService {
  constructor(
    @InjectRepository(SyncSchedule)
    private syncScheduleRepository: Repository<SyncSchedule>,
    private configService: ConfigService,
  ) {
    this.initializeSchedules();
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
      }
    }
  }

  private convertMilitaryTimeToCron(time: string): string {
    const [hours, minutes] = time.split(':');
    return `${minutes} ${hours} * * *`;
  }

  private isLessThanOneMinuteBeforeExecution(currentTime: string): boolean {
    const now = new Date();
    const [hours, minutes] = currentTime.split(':').map(Number);
    const scheduleDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hours,
      minutes,
    );

    // If schedule time has passed for today, check against tomorrow's schedule
    if (scheduleDate < now) {
      scheduleDate.setDate(scheduleDate.getDate() + 1);
    }

    const diffInMinutes =
      (scheduleDate.getTime() - now.getTime()) / (1000 * 60);
    return diffInMinutes < 1;
  }

  async updateSchedule(scheduleNumber: number, time: string) {
    // First, find the existing schedule
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

    // Check if we're too close to execution time
    const tooCloseToExecution = this.isLessThanOneMinuteBeforeExecution(
      existingSchedule.time,
    );

    // Convert time (e.g. "14:30") to cron format (e.g. "30 14 * * *")
    const cronExpression = this.convertMilitaryTimeToCron(time);

    // Update the schedule in database
    existingSchedule.time = time;
    existingSchedule.cronExpression = cronExpression;
    await this.syncScheduleRepository.save(existingSchedule);

    // Notify Jenkins about the change
    await this.updateJenkinsJob(scheduleNumber, cronExpression);

    // Return appropriate message based on timing
    if (tooCloseToExecution) {
      return {
        message:
          'Schedule updated successfully. Changes will take effect from tomorrow as the current schedule is due to execute in less than 1 minute.',
        scheduleNumber,
        time,
        effectiveFrom: 'next day',
      };
    }

    return {
      message: 'Schedule updated successfully',
      scheduleNumber,
      time,
      effectiveFrom: 'immediate',
    };
  }

  private async updateJenkinsJob(
    scheduleNumber: number,
    cronExpression: string,
  ) {
    const jenkinsUrl = this.configService.get('JENKINS_URL');
    const jenkinsToken = this.configService.get('JENKINS_API_TOKEN');

    try {
      await axios.post(
        `${jenkinsUrl}/job/database-sync-${scheduleNumber}/config.xml`,
        {
          cronExpression,
        },
        {
          headers: {
            Authorization: `Bearer ${jenkinsToken}`,
          },
        },
      );
    } catch (error) {
      console.error('Failed to update Jenkins job:', error);
      // Don't throw the error as this is a secondary operation
    }
  }

  async getAllSchedules(): Promise<ScheduledSyncDto[]> {
    const schedules = await this.syncScheduleRepository.find();
    return schedules.map((schedule) => ({
      scheduleNumber: schedule.scheduleNumber,
      time: schedule.time,
      isActive: true,
      lastSyncTime: schedule.lastSyncTime || null,
    }));
  }

  async getJenkinsJobsStatus(): Promise<JenkinsJobStatus[]> {
    const jenkinsUrl = this.configService.get('JENKINS_URL');
    const jenkinsToken = this.configService.get('JENKINS_API_TOKEN');

    try {
      const jobs = [];

      // Get status for both scheduled jobs
      for (let scheduleNumber = 1; scheduleNumber <= 2; scheduleNumber++) {
        const response = await axios.get(
          `${jenkinsUrl}/job/database-sync-${scheduleNumber}/api/json`,
          {
            headers: {
              Authorization: `Bearer ${jenkinsToken}`,
            },
          },
        );

        const lastBuild = response.data.lastBuild;
        const nextBuildTime = response.data.nextBuildTime;

        jobs.push({
          jobName: `Scheduled Sync ${scheduleNumber}`,
          isRunning: response.data.inQueue || response.data.building,
          lastBuildStatus: lastBuild ? lastBuild.result : null,
          lastBuildTime: lastBuild ? new Date(lastBuild.timestamp) : null,
          nextScheduledRun: nextBuildTime ? new Date(nextBuildTime) : null,
        });
      }

      // Get status for manual sync job
      const manualSyncResponse = await axios.get(
        `${jenkinsUrl}/job/database-sync-manual/api/json`,
        {
          headers: {
            Authorization: `Bearer ${jenkinsToken}`,
          },
        },
      );

      jobs.push({
        jobName: 'Manual Sync',
        isRunning:
          manualSyncResponse.data.inQueue || manualSyncResponse.data.building,
        lastBuildStatus: manualSyncResponse.data.lastBuild?.result || null,
        lastBuildTime: manualSyncResponse.data.lastBuild
          ? new Date(manualSyncResponse.data.lastBuild.timestamp)
          : null,
        nextScheduledRun: null, // Manual jobs don't have scheduled runs
      });

      return jobs;
    } catch (error) {
      console.error('Failed to fetch Jenkins jobs status:', error);
      throw new BadRequestException('Failed to fetch Jenkins jobs status');
    }
  }

  // Add this method to check if a sync is running
  async isSyncRunning(queueId: string): Promise<boolean> {
    const jenkinsUrl = this.configService.get('JENKINS_URL');
    const jenkinsToken = this.configService.get('JENKINS_API_TOKEN');

    try {
      const response = await axios.get(
        `${jenkinsUrl}/job/database-sync-manual/api/json`,
        {
          headers: {
            Authorization: `Bearer ${jenkinsToken}`,
          },
        },
      );

      // Check if the job with this queueId is currently running
      const isRunning = response.data.builds?.some(
        (build: any) =>
          build.building && build.parameters?.QUEUE_ID === queueId,
      );

      return isRunning;
    } catch (error) {
      console.error('Failed to check sync status:', error);
      throw new BadRequestException('Failed to check sync status');
    }
  }

  // Add this method to check if a sync is scheduled
  private async isScheduledSync(queueId: string): Promise<boolean> {
    const jenkinsUrl = this.configService.get('JENKINS_URL');
    const jenkinsToken = this.configService.get('JENKINS_API_TOKEN');

    try {
      // Check both scheduled jobs
      for (let scheduleNumber = 1; scheduleNumber <= 2; scheduleNumber++) {
        const response = await axios.get(
          `${jenkinsUrl}/job/database-sync-${scheduleNumber}/api/json`,
          {
            headers: {
              Authorization: `Bearer ${jenkinsToken}`,
            },
          },
        );

        const hasQueueId = response.data.builds?.some(
          (build: any) => build.parameters?.QUEUE_ID === queueId,
        );

        if (hasQueueId) {
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Failed to check if sync is scheduled:', error);
      throw new BadRequestException('Failed to check sync type');
    }
  }

  async removePendingSync(queueId: string) {
    // Check if this is a scheduled sync
    const isScheduled = await this.isScheduledSync(queueId);
    if (isScheduled) {
      throw new BadRequestException(
        'Cannot delete scheduled syncs. Only manual syncs can be deleted.',
      );
    }

    // Check if sync is running
    const isRunning = await this.isSyncRunning(queueId);
    if (isRunning) {
      throw new BadRequestException(
        'Cannot delete a sync that is currently running',
      );
    }

    // Proceed with deletion if not running and not scheduled
    try {
      const jenkinsUrl = this.configService.get('JENKINS_URL');
      const jenkinsToken = this.configService.get('JENKINS_API_TOKEN');

      await axios.post(
        `${jenkinsUrl}/job/database-sync-manual/${queueId}/kill`,
        {},
        {
          headers: {
            Authorization: `Bearer ${jenkinsToken}`,
          },
        },
      );

      return { message: 'Sync job successfully removed from queue' };
    } catch (error) {
      if (error.response?.status === 404) {
        throw new NotFoundException('Queue item not found');
      }
      throw new BadRequestException('Failed to remove sync from queue');
    }
  }
}
