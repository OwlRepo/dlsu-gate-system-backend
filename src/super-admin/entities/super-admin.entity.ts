import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('super_admin')
export class SuperAdmin {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  super_admin_id: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true, default: 'Unknown' })
  first_name: string;

  @Column({ nullable: true, default: 'User' })
  last_name: string;

  @Column()
  role: string;
}
