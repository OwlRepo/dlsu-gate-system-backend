import { DataSource } from 'typeorm';
import { Admin } from '../admin/entities/admin.entity';
import { SuperAdmin } from '../super-admin/entities/super-admin.entity';
import { Employee } from '../employee/entities/employee.entity';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

// Get all migration files and sort by timestamp
const getMigrationFiles = async () => {
  try {
    const migrationsPath = path.join(__dirname, '../migrations');

    if (!fs.existsSync(migrationsPath)) {
      console.log('No migrations directory found');
      return [];
    }

    const files = fs
      .readdirSync(migrationsPath)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'))
      .sort((a, b) => {
        const timestampA = parseInt(a.split('-')[0]);
        const timestampB = parseInt(b.split('-')[0]);
        return timestampB - timestampA; // Sort in descending order
      });

    if (files.length === 0) {
      console.log('No migration files found');
      return [];
    }

    // Import and return the latest migration
    const latestFile = files[0];
    console.log('Running migration:', latestFile);
    const migrationName = latestFile
      .replace('.ts', '')
      .split('-')
      .slice(1)
      .join('-');
    const timestamp = latestFile.split('-')[0];
    const migration = await import(`../migrations/${latestFile}`);
    return [migration[`${migrationName}${timestamp}`]];
  } catch (error) {
    console.error('Error loading migrations:', error);
    return [];
  }
};

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'dlsu_portal',
  entities: [Admin, SuperAdmin, Employee],
  migrations: [], // Empty array initially
  synchronize: false,
});

// Load migrations after initialization
getMigrationFiles().then((migrations) => {
  AppDataSource.setOptions({ migrations });
});
