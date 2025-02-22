import { DataSource } from 'typeorm';
import { Admin } from '../admin/entities/admin.entity';
import { SuperAdmin } from '../super-admin/entities/super-admin.entity';
import { Employee } from '../employee/entities/employee.entity';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

// Get all migration files
const getMigrationFiles = () => {
  const migrationsPath = path.join(__dirname, '../migrations');
  const migrationPattern = path.join(migrationsPath, '*.{ts,js}');
  console.log('📂 Looking for migrations in:', migrationsPath);
  return [migrationPattern];
};

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'dlsu_portal',
  entities: [Admin, SuperAdmin, Employee],
  migrations: getMigrationFiles(),
  synchronize: false,
  logging: ['error', 'warn', 'migration'],
});
