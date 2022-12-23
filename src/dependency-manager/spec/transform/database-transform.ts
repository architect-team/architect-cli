import { ServiceConfig } from '../../config/service-config';
import { ComponentInstanceMetadata } from '../component-spec';
import { DatabaseSpec } from '../database-spec';
import { ServiceSpec } from '../service-spec';
import { transformServiceSpec } from './service-transform';

const DEFAULT_CREDENTIALS = {
  username: 'architect',
  password: 'password',
  database: 'architect',
};

type SupportedDatabaseType = {
  engine: string;
  versions: { min?: number; max?: number };
  spec: ServiceSpec;
};

const SupportedDatabases: SupportedDatabaseType[] = [
  {
    engine: 'postgres',
    versions: {
      min: 10,
    },
    spec: {
      image: 'postgres:15',
      environment: {
        POSTGRES_USER: DEFAULT_CREDENTIALS.username,
        POSTGRES_PASSWORD: DEFAULT_CREDENTIALS.password,
        POSTGRES_DB: DEFAULT_CREDENTIALS.database,
      },
      interfaces: {
        main: {
          protocol: 'postgresql',
          port: 5432,
          username: DEFAULT_CREDENTIALS.username,
          password: DEFAULT_CREDENTIALS.password,
          path: `/${DEFAULT_CREDENTIALS.database}`,
        },
      },
    },
  },
  {
    engine: 'mysql',
    versions: {
      min: 5,
      max: 5,
    },
    spec: {
      image: 'mysql:5',
      environment: {
        MYSQL_USER: DEFAULT_CREDENTIALS.username,
        MYSQL_PASSWORD: DEFAULT_CREDENTIALS.password,
        MYSQL_DATABASE: DEFAULT_CREDENTIALS.database,
      },
      interfaces: {
        main: {
          protocol: 'mysql',
          port: 3306,
          username: DEFAULT_CREDENTIALS.username,
          password: DEFAULT_CREDENTIALS.password,
          path: `/${DEFAULT_CREDENTIALS.database}`,
        },
      },
    },
  },
  {
    engine: 'mariadb',
    versions: {
      min: 10,
    },
    spec: {
      image: 'mariadb:10',
      environment: {
        MARIADB_USER: DEFAULT_CREDENTIALS.username,
        MARIADB_PASSWORD: DEFAULT_CREDENTIALS.password,
        MARIADB_DATABASE: DEFAULT_CREDENTIALS.database,
      },
      interfaces: {
        main: {
          protocol: 'mariadb',
          port: 3306,
          username: DEFAULT_CREDENTIALS.username,
          password: DEFAULT_CREDENTIALS.password,
          path: `/${DEFAULT_CREDENTIALS.database}`,
        },
      },
    },
  },
];

export const transformDatabaseSpec = (key: string, db_spec: DatabaseSpec, metadata: ComponentInstanceMetadata): ServiceConfig => {
  const [engine, version] = db_spec.type.split(':');

  const match = SupportedDatabases.find(match =>
    match.engine === engine &&
    Number(version) >= (match.versions.min || 0) &&
    Number(version) <= (match.versions.max || 1000));

  if (!match) {
    throw new Error(`Unsupported database engine: ${engine}`);
  }

  const service_spec = match.spec;
  service_spec.image = db_spec.type;
  return transformServiceSpec(`${key}-db`, service_spec, metadata);
};
