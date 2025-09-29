import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPasswordAndRoleToAgent1758568902719 implements MigrationInterface {
    name = 'AddPasswordAndRoleToAgent1758568902719'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Suppression des DROP FOREIGN KEY qui posaient problème
        // await queryRunner.query(`ALTER TABLE \`tincidents\` DROP FOREIGN KEY \`tincidents_ibfk_1\``);
        // await queryRunner.query(`ALTER TABLE \`tincidents\` DROP FOREIGN KEY \`tincidents_ibfk_2\``);

        await queryRunner.query(`DROP INDEX \`state\` ON \`tincidents\``);
        await queryRunner.query(`DROP INDEX \`subcat\` ON \`tincidents\``);
        await queryRunner.query(`DROP INDEX \`fk_technician\` ON \`tincidents\``);
        await queryRunner.query(`DROP INDEX \`mail\` ON \`tusers\``);

        await queryRunner.query(`ALTER TABLE \`tsubcat\` DROP PRIMARY KEY`);
        await queryRunner.query(`ALTER TABLE \`tsubcat\` DROP COLUMN \`id\``);
        await queryRunner.query(`ALTER TABLE \`tsubcat\` ADD \`id\` int NOT NULL PRIMARY KEY AUTO_INCREMENT`);
        await queryRunner.query(`ALTER TABLE \`tsubcat\` DROP COLUMN \`name\``);
        await queryRunner.query(`ALTER TABLE \`tsubcat\` ADD \`name\` varchar(255) NOT NULL`);

        await queryRunner.query(`ALTER TABLE \`tincidents\` CHANGE \`state\` \`state\` int NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`tincidents\` CHANGE \`date_create\` \`date_create\` datetime NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`tincidents\` CHANGE \`date_res\` \`date_res\` datetime NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`tincidents\` CHANGE \`subcat\` \`subcat\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`tincidents\` CHANGE \`technician\` \`technician\` int NULL`);

        await queryRunner.query(`ALTER TABLE \`tusers\` DROP COLUMN \`id\``);
        await queryRunner.query(`ALTER TABLE \`tusers\` ADD \`id\` int NOT NULL PRIMARY KEY AUTO_INCREMENT`);
        await queryRunner.query(`ALTER TABLE \`tusers\` DROP COLUMN \`lastname\``);
        await queryRunner.query(`ALTER TABLE \`tusers\` ADD \`lastname\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`tusers\` DROP COLUMN \`firstname\``);
        await queryRunner.query(`ALTER TABLE \`tusers\` ADD \`firstname\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`tusers\` DROP COLUMN \`function\``);
        await queryRunner.query(`ALTER TABLE \`tusers\` ADD \`function\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`tusers\` DROP COLUMN \`phone\``);
        await queryRunner.query(`ALTER TABLE \`tusers\` ADD \`phone\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`tusers\` DROP COLUMN \`mail\``);
        await queryRunner.query(`ALTER TABLE \`tusers\` ADD \`mail\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`tusers\` CHANGE \`password\` \`password\` varchar(512) NULL`);

        // Création des FKs seulement si les données existantes ne posent pas de problème
        await queryRunner.query(`
            ALTER TABLE \`tincidents\` 
            ADD CONSTRAINT \`FK_e4d815cb2d957bd96be4922cff3\` 
            FOREIGN KEY (\`subcat\`) REFERENCES \`tsubcat\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE \`tincidents\` 
            ADD CONSTRAINT \`FK_2e272400546f0f409be1a816827\` 
            FOREIGN KEY (\`technician\`) REFERENCES \`tusers\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`tincidents\` DROP FOREIGN KEY \`FK_2e272400546f0f409be1a816827\``);
        await queryRunner.query(`ALTER TABLE \`tincidents\` DROP FOREIGN KEY \`FK_e4d815cb2d957bd96be4922cff3\``);
    }
}
