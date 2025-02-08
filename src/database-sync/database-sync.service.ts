import { Injectable, BadRequestException } from '@nestjs/common';
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
  ) {}

  private convertMilitaryTimeToCron(time: string): string {
    const [hours, minutes] = time.split(':');
    return `${minutes} ${hours} * * *`;
  }

  async updateSchedule(scheduleNumber: number, time: string) {
    if (scheduleNumber !== 1 && scheduleNumber !== 2) {
      throw new BadRequestException('Schedule number must be 1 or 2');
    }

    const cronExpression = this.convertMilitaryTimeToCron(time);

    const existingSchedule = await this.syncScheduleRepository.findOne({
      where: { scheduleNumber },
    });

    if (existingSchedule) {
      existingSchedule.time = time;
      existingSchedule.cronExpression = cronExpression;
      return this.syncScheduleRepository.save(existingSchedule);
    }

    const newSchedule = this.syncScheduleRepository.create({
      scheduleNumber,
      time,
      cronExpression,
    });

    await this.syncScheduleRepository.save(newSchedule);

    // Notify Jenkins about the schedule update
    await this.updateJenkinsJob(scheduleNumber, cronExpression);
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
}
