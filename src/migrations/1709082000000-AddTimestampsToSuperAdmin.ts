import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTimestampsToSuperAdmin1709082000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add columns with nullable constraint first
    await queryRunner.query(`
      ALTER TABLE "super-admin"
      ADD COLUMN "created_at" TIMESTAMP,
      ADD COLUMN "updated_at" TIMESTAMP
    `);

    // Update existing records with current timestamp
    await queryRunner.query(`
      UPDATE "super-admin"
      SET created_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE created_at IS NULL
         OR updated_at IS NULL
    `);

    // Now make the columns non-nullable
    await queryRunner.query(`
      ALTER TABLE "super-admin"
      ALTER COLUMN "created_at" SET NOT NULL,
      ALTER COLUMN "updated_at" SET NOT NULL
    `);

    // Set default values for future records
    await queryRunner.query(`
      ALTER TABLE "super-admin"
      ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
      ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP
    `);

    // Create trigger to automatically update updated_at
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_super_admin_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trigger_update_super_admin_updated_at
      BEFORE UPDATE ON "super-admin"
      FOR EACH ROW
      EXECUTE FUNCTION update_super_admin_updated_at();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove trigger and function
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trigger_update_super_admin_updated_at ON "super-admin";
    `);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS update_super_admin_updated_at();
    `);

    // Remove columns
    await queryRunner.query(`
      ALTER TABLE "super-admin"
      DROP COLUMN "updated_at",
      DROP COLUMN "created_at"
    `);
  }
}
