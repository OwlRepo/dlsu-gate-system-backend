import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSuperAdminIdAndNullableName1234567890123
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add super_admin_id column
    await queryRunner.query(`
      ALTER TABLE "super-admin"
      ADD COLUMN IF NOT EXISTS "super_admin_id" VARCHAR UNIQUE
    `);

    // Update existing records with a generated super_admin_id
    await queryRunner.query(`
      UPDATE "super-admin"
      SET "super_admin_id" = 'SAD-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 12))
      WHERE "super_admin_id" IS NULL
    `);

    // Make super_admin_id NOT NULL after populating it
    await queryRunner.query(`
      ALTER TABLE "super-admin"
      ALTER COLUMN "super_admin_id" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert name column to NOT NULL
    await queryRunner.query(`
      UPDATE "super-admin"
      SET "name" = 'Legacy Super Admin'
      WHERE "name" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "super-admin"
      ALTER COLUMN "name" SET NOT NULL
    `);

    // Remove super_admin_id column
    await queryRunner.query(`
      ALTER TABLE "super-admin"
      DROP COLUMN "super_admin_id"
    `);
  }
}
