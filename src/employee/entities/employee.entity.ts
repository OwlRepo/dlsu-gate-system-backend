import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column()
  employeeId: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  is_active: boolean;

  @Column()
  dateCreated: string;

  @Column()
  dateActivated: string;

  @Column({ nullable: true })
  dateDeactivated: string;

  @Column('simple-array')
  deviceId: string[];

  @Column()
  email: string;
}
