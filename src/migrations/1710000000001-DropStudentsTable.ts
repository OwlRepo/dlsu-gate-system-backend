import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropStudentsTable1710000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "students" CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No down migration needed as the next migration will create the table
  }
}
