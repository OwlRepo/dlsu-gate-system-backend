import { MigrationInterface, QueryRunner } from 'typeorm';

export class RunAllMigrations1744090868338 implements MigrationInterface {
  name = 'RunAllMigrations1744090868338';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create initial tables
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create admin table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin" (
        "id" SERIAL PRIMARY KEY,
        "username" VARCHAR(255) UNIQUE NOT NULL,
        "email" VARCHAR(255) UNIQUE NOT NULL,
        "password" VARCHAR(255) NOT NULL,
        "role" VARCHAR(255) NOT NULL,
        "admin_id" VARCHAR(255) NOT NULL,
        "first_name" VARCHAR(255) DEFAULT 'Unknown',
        "last_name" VARCHAR(255) DEFAULT 'Admin',
        "is_active" BOOLEAN DEFAULT true,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create super-admin table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "super-admin" (
        "id" SERIAL PRIMARY KEY,
        "super_admin_id" VARCHAR(255) UNIQUE NOT NULL,
        "username" VARCHAR(255) UNIQUE NOT NULL,
        "email" VARCHAR(255) UNIQUE NOT NULL,
        "password" VARCHAR(255) NOT NULL,
        "first_name" VARCHAR(255) DEFAULT 'Unknown',
        "last_name" VARCHAR(255) DEFAULT 'User',
        "role" VARCHAR(255) NOT NULL,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create employee table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "employee" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "username" VARCHAR(255) UNIQUE NOT NULL,
        "password" VARCHAR(255) NOT NULL,
        "employee_id" VARCHAR(255) NOT NULL,
        "first_name" VARCHAR(255) NOT NULL,
        "last_name" VARCHAR(255) NOT NULL,
        "is_active" BOOLEAN NOT NULL,
        "date_created" VARCHAR(255) NOT NULL,
        "date_activated" VARCHAR(255) NOT NULL,
        "date_deactivated" VARCHAR(255),
        "device_id" JSON DEFAULT '[]',
        "email" VARCHAR(255) UNIQUE NOT NULL
      )
    `);

    // Create students table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "students" (
        "id" SERIAL PRIMARY KEY,
        "ID_Number" VARCHAR(32) NOT NULL,
        "Name" VARCHAR(99),
        "Lived_Name" INTEGER,
        "Remarks" VARCHAR(7),
        "Photo" VARCHAR(46) NOT NULL,
        "Campus_Entry" VARCHAR(1) NOT NULL,
        "Unique_ID" INTEGER,
        "isArchived" BOOLEAN DEFAULT false,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create reports table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reports" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "datetime" TIMESTAMP NOT NULL,
        "type" VARCHAR(255) NOT NULL,
        "user_id" VARCHAR(255) NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "remarks" TEXT,
        "status" VARCHAR(255) NOT NULL,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create sync_schedule table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sync_schedule" (
        "id" SERIAL PRIMARY KEY,
        "scheduleNumber" INTEGER NOT NULL,
        "time" VARCHAR(255) NOT NULL,
        "cronExpression" VARCHAR(255) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "lastSyncTime" TIMESTAMP
      )
    `);

    // Create sync_queue table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sync_queue" (
        "id" SERIAL PRIMARY KEY,
        "status" VARCHAR(255) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "completedAt" TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create token_blacklist table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "token_blacklist" (
        "id" SERIAL PRIMARY KEY,
        "token" TEXT NOT NULL,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add activation columns to users
    await queryRunner.query(`
      ALTER TABLE "admin" 
      ADD COLUMN IF NOT EXISTS "is_activated" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "activation_token" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "activation_token_expires" TIMESTAMP
    `);

    // Update student column types and constraints
    await queryRunner.query(`
      ALTER TABLE "students" 
      ALTER COLUMN "Lived_Name" DROP NOT NULL,
      ALTER COLUMN "Name" DROP NOT NULL,
      ALTER COLUMN "Remarks" DROP NOT NULL,
      ALTER COLUMN "Photo" DROP NOT NULL,
      ALTER COLUMN "Campus_Entry" DROP NOT NULL
    `);

    // Update Unique_ID column type
    await queryRunner.query(`
      ALTER TABLE "students" 
      ALTER COLUMN "Unique_ID" TYPE VARCHAR(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE IF EXISTS "sync_queue"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sync_schedule"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reports"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "students"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "employee"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "super-admin"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "token_blacklist"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS "uuid-ossp"`);
  }
}
