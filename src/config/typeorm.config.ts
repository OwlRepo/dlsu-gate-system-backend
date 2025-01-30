import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres', // or your database type
  host: 'localhost',
  port: 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '123',
  database: process.env.DB_NAME || 'dlsu_gate_system',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false,
});
