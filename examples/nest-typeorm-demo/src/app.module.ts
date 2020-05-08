import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';


export const getConnectionOptions = () => {
  return {
    keepConnectionAlive: this.environment === 'local',
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost', //TODO:66:remove
    port: process.env.DB_PORT || 5432,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'architect',
    database: 'typeorm_demo',
    entities: [],
    synchronize: false,
    migrationsRun: false,
    logging: ['warn', 'error'],
    maxQueryExecutionTime: 1000,
    migrations: ['../typeorm/migrations/*.{js,ts}'],
    cli: {
      migrationsDir: 'src/typeorm/migrations',
    },
  };
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [],
      inject: [],
      useFactory: async () => (getConnectionOptions() as TypeOrmModuleOptions),
    }),
    UserModule,
  ],
  controllers: [
    AppController
  ],
  providers: [
    AppService,
  ],
})
export class AppModule { }
