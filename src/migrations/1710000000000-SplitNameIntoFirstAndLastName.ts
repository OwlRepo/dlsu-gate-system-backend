import { MigrationInterface, QueryRunner } from 'typeorm';

export class SplitNameIntoFirstAndLastName1710000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // First ensure the new columns exist with defaults
    await queryRunner.query(`
      DO $$ 
      BEGIN 
        BEGIN
          ALTER TABLE "super-admin" 
          ADD COLUMN "first_name" varchar NULL DEFAULT 'Unknown',
          ADD COLUMN "last_name" varchar NULL DEFAULT 'User';
        EXCEPTION 
          WHEN duplicate_column THEN NULL;
        END;
        
        BEGIN
          ALTER TABLE "admin" 
          ADD COLUMN "first_name" varchar NULL DEFAULT 'Unknown',
          ADD COLUMN "last_name" varchar NULL DEFAULT 'Admin';
        EXCEPTION 
          WHEN duplicate_column THEN NULL;
        END;
      END $$;
    `);

    // Update any NULL values with defaults
    await queryRunner.query(`
      UPDATE "super-admin" 
      SET first_name = 'Unknown' 
      WHERE first_name IS NULL;

      UPDATE "super-admin" 
      SET last_name = 'User' 
      WHERE last_name IS NULL;

      UPDATE "admin" 
      SET first_name = 'Unknown' 
      WHERE first_name IS NULL;

      UPDATE "admin" 
      SET last_name = 'Admin' 
      WHERE last_name IS NULL;
    `);

    // Check and drop name column if it exists
    await queryRunner.query(`
      DO $$ 
      BEGIN 
        IF EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'super-admin' 
          AND column_name = 'name'
        ) THEN
          ALTER TABLE "super-admin" DROP COLUMN "name";
        END IF;

        IF EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'admin' 
          AND column_name = 'name'
        ) THEN
          ALTER TABLE "admin" DROP COLUMN "name";
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert changes
    await queryRunner.query(`
      DO $$ 
      BEGIN 
        ALTER TABLE "super-admin" ADD COLUMN "name" varchar DEFAULT 'Unknown User';
        ALTER TABLE "admin" ADD COLUMN "name" varchar DEFAULT 'Unknown Admin';

        UPDATE "super-admin" 
        SET "name" = COALESCE(first_name, 'Unknown') || 
                    CASE WHEN last_name IS NOT NULL AND last_name != '' 
                         THEN ' ' || last_name 
                         ELSE '' 
                    END;
        
        UPDATE "admin" 
        SET "name" = COALESCE(first_name, 'Unknown') || 
                    CASE WHEN last_name IS NOT NULL AND last_name != '' 
                         THEN ' ' || last_name 
                         ELSE '' 
                    END;

        ALTER TABLE "super-admin" DROP COLUMN "first_name", DROP COLUMN "last_name";
        ALTER TABLE "admin" DROP COLUMN "first_name", DROP COLUMN "last_name";
      END $$;
    `);
  }
}
