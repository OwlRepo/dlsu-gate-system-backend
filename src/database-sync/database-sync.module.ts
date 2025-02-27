import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseSyncController } from './database-sync.controller';
import { DatabaseSyncService } from './database-sync.service';
import { SyncSchedule } from './entities/sync-schedule.entity';
import { Student } from '../students/entities/student.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SyncSchedule, Student]),
    ScheduleModule.forRoot(),
  ],
  controllers: [DatabaseSyncController],
  providers: [DatabaseSyncService],
  exports: [DatabaseSyncService],
})
export class DatabaseSyncModule {}
