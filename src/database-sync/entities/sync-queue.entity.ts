import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class SyncQueue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  status: 'pending' | 'processing' | 'completed' | 'failed';

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  completedAt: Date;
}
