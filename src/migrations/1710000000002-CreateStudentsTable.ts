import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStudentsTable1710000000002 implements MigrationInterface {
  name = 'CreateStudentsTable1710000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "students" (
        "id" SERIAL NOT NULL,
        "ID_Number" character varying(32) NOT NULL,
        "Name" character varying(99),
        "Lived_Name" integer,
        "Remarks" character varying(7),
        "Photo" character varying(46) NOT NULL,
        "Campus_Entry" character varying(1) NOT NULL,
        "Unique_ID" integer,
        "isArchived" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_students" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "students"`);
  }
}
