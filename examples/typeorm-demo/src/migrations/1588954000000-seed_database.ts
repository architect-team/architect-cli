import { MigrationInterface, QueryRunner } from "typeorm";

export class seedDatabase1588954000000 implements MigrationInterface {
    name = 'seedDatabase1588954000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`INSERT INTO "user" ("firstName", "lastName") VALUES ('Jimmy', 'Page'), ('Robert', 'Plant'), ('Jon', 'Bonham'), ('John Paul', 'Jones')`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {

    }

}
