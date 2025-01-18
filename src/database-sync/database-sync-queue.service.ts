import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncQueue } from './entities/sync-queue.entity';

@Injectable()
export class DatabaseSyncQueueService {
  constructor(
    @InjectRepository(SyncQueue)
    private syncQueueRepository: Repository<SyncQueue>,
  ) {}

  async addToQueue() {
    const currentQueueSize = await this.getCurrentQueueSize();
    if (currentQueueSize >= 4) {
      throw new BadRequestException(
        'Queue is full - maximum 4 pending syncs allowed',
      );
    }

    const queueId = await this.createQueueEntry();
    return {
      queueId,
      position: currentQueueSize + 1,
    };
  }

  async removeFromQueue(queueId: string) {
    const queueItem = await this.findQueueItem(queueId);
    if (!queueItem) {
      throw new NotFoundException('Queue item not found');
    }

    if (queueItem.status === 'processing') {
      throw new BadRequestException(
        'Cannot delete - sync is already in progress',
      );
    }

    await this.deleteQueueItem(queueId);
    return { message: 'Sync job successfully removed from queue' };
  }

  async updateQueueStatus(
    id: number,
    status: 'processing' | 'completed' | 'failed',
  ) {
    const queueItem = await this.syncQueueRepository.findOne({
      where: { id },
    });

    if (!queueItem) {
      throw new BadRequestException('Queue item not found');
    }

    queueItem.status = status;
    if (status === 'completed') {
      queueItem.completedAt = new Date();
    }

    return this.syncQueueRepository.save(queueItem);
  }

  private async getCurrentQueueSize(): Promise<number> {
    return this.syncQueueRepository.count({
      where: [{ status: 'pending' }, { status: 'processing' }],
    });
  }

  private async createQueueEntry(): Promise<string> {
    const queueItem = this.syncQueueRepository.create({
      status: 'pending',
    });
    const saved = await this.syncQueueRepository.save(queueItem);
    return saved.id.toString();
  }

  private async findQueueItem(queueId: string): Promise<SyncQueue | null> {
    return this.syncQueueRepository.findOne({
      where: { id: parseInt(queueId) },
    });
  }

  private async deleteQueueItem(queueId: string): Promise<void> {
    await this.syncQueueRepository.delete(parseInt(queueId));
  }
}
