import { DataSource } from 'typeorm';
import { Admin } from '../admin/entities/admin.entity';
import { SuperAdmin } from '../super-admin/entities/super-admin.entity';
import { Employee } from '../employee/entities/employee.entity';
import { SplitNameIntoFirstAndLastName1710000000000 } from '../migrations/1710000000000-SplitNameIntoFirstAndLastName';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'dlsu_portal',
  entities: [Admin, SuperAdmin, Employee],
  migrations: [SplitNameIntoFirstAndLastName1710000000000],
  synchronize: false,
});
