import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSuperAdminIdAndNullableName1234567890123
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add super_admin_id column
    await queryRunner.query(`
      ALTER TABLE "super_admins"
      ADD COLUMN IF NOT EXISTS "super_admin_id" VARCHAR UNIQUE
    `);

    // Update existing records with a generated super_admin_id
    await queryRunner.query(`
      UPDATE "super_admins"
      SET "super_admin_id" = 'SAD-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 12))
      WHERE "super_admin_id" IS NULL
    `);

    // Make super_admin_id NOT NULL after populating it
    await queryRunner.query(`
      ALTER TABLE "super_admins"
      ALTER COLUMN "super_admin_id" SET NOT NULL
    `);

    // Modify name column to be nullable
    await queryRunner.query(`
      ALTER TABLE "super_admins"
      ALTER COLUMN "name" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert name column to NOT NULL
    await queryRunner.query(`
      UPDATE "super_admins"
      SET "name" = 'Legacy Super Admin'
      WHERE "name" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "super_admins"
      ALTER COLUMN "name" SET NOT NULL
    `);

    // Remove super_admin_id column
    await queryRunner.query(`
      ALTER TABLE "super_admins"
      DROP COLUMN "super_admin_id"
    `);
  }
}
