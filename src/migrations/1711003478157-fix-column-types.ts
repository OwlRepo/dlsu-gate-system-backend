import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixColumnTypes1711003478157 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // First, alter the isArchived column to varchar temporarily to handle 'Y'/'N' values
    await queryRunner.query(`
      ALTER TABLE students 
      ALTER COLUMN "isArchived" TYPE varchar(1)
    `);

    // Then convert 'Y'/'N' values to proper boolean values
    await queryRunner.query(`
      UPDATE students 
      SET "isArchived" = CASE 
        WHEN "isArchived" = 'Y' THEN 'true'
        ELSE 'false'
      END
    `);

    // Now alter isArchived to boolean
    await queryRunner.query(`
      ALTER TABLE students 
      ALTER COLUMN "isArchived" TYPE boolean USING CASE 
        WHEN "isArchived" = 'true' THEN true 
        ELSE false 
      END
    `);

    // Finally, alter the Unique_ID column to varchar
    await queryRunner.query(`
      ALTER TABLE students 
      ALTER COLUMN "Unique_ID" TYPE varchar(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // First convert isArchived back to varchar
    await queryRunner.query(`
      ALTER TABLE students 
      ALTER COLUMN "isArchived" TYPE varchar(1)
    `);

    // Convert boolean values back to 'Y'/'N'
    await queryRunner.query(`
      UPDATE students 
      SET "isArchived" = CASE 
        WHEN "isArchived"::boolean = true THEN 'Y'
        ELSE 'N'
      END
    `);

    // Revert the Unique_ID column
    await queryRunner.query(`
      ALTER TABLE students 
      ALTER COLUMN "Unique_ID" TYPE integer
    `);
  }
}
