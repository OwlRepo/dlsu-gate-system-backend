import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSyncQueueTable1744090868339 implements MigrationInterface {
  name = 'UpdateSyncQueueTable1744090868339';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the existing sync_queue table if it exists
    await queryRunner.query(`DROP TABLE IF EXISTS "sync_queue"`);

    // Create the enum type for sync status
    await queryRunner.query(`
      CREATE TYPE "sync_queue_status_enum" AS ENUM ('pending', 'processing', 'completed', 'failed')
    `);

    // Create the sync_queue table with proper structure
    await queryRunner.query(`
      CREATE TABLE "sync_queue" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "status" "sync_queue_status_enum" NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "completedAt" TIMESTAMP
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sync_queue"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "sync_queue_status_enum"`);
  }
}
