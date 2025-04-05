import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUpdatedAtToSyncQueue1709711000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sync_queue" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sync_queue" DROP COLUMN "updatedAt"`);
  }
}
