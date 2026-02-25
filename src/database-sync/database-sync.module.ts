import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseSyncController } from './database-sync.controller';
import { DatabaseSyncService } from './database-sync.service';
import { SyncSchedule } from './entities/sync-schedule.entity';
import { Student } from '../students/entities/student.entity';
import { DatabaseSyncQueueService } from './database-sync-queue.service';
import { SyncQueue } from './entities/sync-queue.entity';
import { BiostarSyncState } from './entities/biostar-sync-state.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SyncSchedule,
      Student,
      SyncQueue,
      BiostarSyncState,
    ]),
    ScheduleModule.forRoot(),
  ],
  controllers: [DatabaseSyncController],
  providers: [DatabaseSyncService, DatabaseSyncQueueService],
  exports: [DatabaseSyncService, DatabaseSyncQueueService],
})
export class DatabaseSyncModule {}
