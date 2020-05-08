"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ConnectionManager = /** @class */ (function () {
    function ConnectionManager() {
    }
    ConnectionManager.getConnectionOptions = function () {
        return {
            type: 'postgres',
            host: process.env.DATABASE_HOST || 'localhost',
            port: process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT) : 5432,
            username: process.env.DATABASE_USER || 'postgres',
            password: process.env.DATABASE_PASSWORD || 'architect',
            database: process.env.DATABASE_SCHEMA || 'typeorm_demo',
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
    };
    return ConnectionManager;
}());
exports.ConnectionManager = ConnectionManager;
