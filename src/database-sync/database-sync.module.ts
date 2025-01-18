import { Module } from '@nestjs/common';
import { DatabaseSyncController } from './database-sync.controller';
import { DatabaseSyncService } from './database-sync.service';
import { DatabaseSyncQueueService } from './database-sync-queue.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncSchedule } from './entities/sync-schedule.entity';
import { SyncQueue } from './entities/sync-queue.entity';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [TypeOrmModule.forFeature([SyncSchedule, SyncQueue]), JwtModule],
  controllers: [DatabaseSyncController],
  providers: [DatabaseSyncService, DatabaseSyncQueueService],
  exports: [DatabaseSyncService, DatabaseSyncQueueService],
})
export class DatabaseSyncModule {}
