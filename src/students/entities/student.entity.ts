import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 32, nullable: false })
  ID_Number: string; // From SQL Server's ID_Number

  @Column({ length: 99, nullable: true })
  Name: string;

  @Column({ type: 'int', nullable: true })
  Lived_Name: number;

  @Column({ length: 7, nullable: true })
  Remarks: string;

  @Column({ length: 46, nullable: false })
  Photo: string;

  @Column({ length: 1, nullable: false })
  Campus_Entry: string;

  @Column({ type: 'int', nullable: true })
  Unique_ID: number;

  @Column({ default: false })
  isArchived: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Add other relevant fields based on your SQL Server schema
}
