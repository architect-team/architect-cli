import * as fs from 'fs';
import * as path from 'path';
import { Connection, ConnectionOptions, Repository } from "typeorm";

export class ConnectionManager {
  private connection: Connection;

  public static getConnectionOptions = (): ConnectionOptions => {
    return {
      type: 'postgres',
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT),
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_SCHEMA,
      entities: [
        "src/entity/*.js"
      ],
      synchronize: false,
      migrationsRun: false,
      logging: true,
      maxQueryExecutionTime: 1000,
      migrations: ['src/migrations/*.js'],
      cli: {
        migrationsDir: 'src/migrations',
      },
    };
  }

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public async runDatabaseDdl() {
    const auto_ddl = process.env.AUTO_DDL;

    if (auto_ddl === 'migrate') {
      console.log(`Running migrations because AUTO_DDL=${auto_ddl}`);
      await this.runMigrations();
    } else if (auto_ddl === 'seed') {
      console.log(`Running migrations and seed script because AUTO_DDL=${auto_ddl}`);
      await this.runMigrations();
      await this.seeDatabase();
    } else if (auto_ddl === 'none') {
      console.log(`Starting up without modifying database because AUTO_DDL=${auto_ddl}`);
    } else {
      throw new Error(`Invalid AUTO_DDL: ${auto_ddl}`);
    }
  }

  private async runMigrations() {
    return await this.connection.runMigrations({
      transaction: 'each',
    });
  }

  private async getRepository<T>(entity: any): Promise<Repository<T>> {
    return this.connection.getRepository(entity);
  }

  private async getEntities() {
    const entities: any = [];
    (await (await this.connection).entityMetadatas).forEach(
      x => entities.push({ name: x.name, tableName: x.tableName })
    );
    return entities;
  }

  private async seeDatabase() {
    const entities = await this.getEntities();
    await this.cleanAll(entities);
    await this.loadAll(entities);
  }

  private async cleanAll(entities: any) {
    try {
      for (const entity of entities) {
        const repository = await this.getRepository(entity.name);
        await repository.query(`ALTER TABLE ${repository.metadata.schema || 'public'}."${entity.tableName}" DISABLE TRIGGER ALL;`);
        await repository.query(`DELETE FROM ${repository.metadata.schema || 'public'}."${entity.tableName}";`);
        await repository.query(`ALTER TABLE ${repository.metadata.schema || 'public'}."${entity.tableName}" ENABLE TRIGGER ALL;`);
      }
    } catch (error) {
      throw new Error(`Error Cleaning Database: ${error}`);
    }
  }

  private async loadAll(entities: any) {
    try {
      const loaded_tables: any = {};
      for (const entity of entities) {
        if (loaded_tables[entity.tableName]) continue;
        loaded_tables[entity.tableName] = true;

        const repository = await this.getRepository(entity.name);
        const fixtureFile = path.join(__dirname, `../fixtures/${entity.tableName}.json`);
        if (fs.existsSync(fixtureFile)) {
          await repository.query(`ALTER TABLE ${repository.metadata.schema || 'public'}."${entity.tableName}" DISABLE TRIGGER ALL;`);
          const items = JSON.parse(fs.readFileSync(fixtureFile, 'utf8'));
          await repository
            .createQueryBuilder(entity.name)
            .insert()
            .values(items)
            .execute();
          await repository.query(`ALTER TABLE ${repository.metadata.schema || 'public'}."${entity.tableName}" ENABLE TRIGGER ALL;`);
        }
      }
    } catch (error) {
      throw new Error(`ERROR loading fixtures on test db: ${error}`);
    }
  }
}
