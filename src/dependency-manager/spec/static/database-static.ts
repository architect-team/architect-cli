const DEFAULT_CREDENTIALS = {
  username: 'architect',
  password: 'password',
  database: 'architect',
};

export type SupportedDatabaseType = {
  engine: string;
  versions: { min: number; max: number };
  spec: any;
};

export const SupportedDatabases: SupportedDatabaseType[] = [
  {
    engine: 'postgres',
    versions: {
      min: 10,
      max: 15,
    },
    spec: {
      resource_type: 'databases',
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
      max: 8,
    },
    spec: {
      resource_type: 'databases',
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
      max: 10,
    },
    spec: {
      resource_type: 'databases',
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

// eslint-disable-next-line unicorn/no-array-reduce
export const SUPPORTED_DATABASE_TYPES = SupportedDatabases.reduce((results, database_type) => {
  const min = database_type.versions.min;
  const max = database_type.versions.max;
  // +1 is to handle min version 5 and max version 5.
  for (let i = min; i < max + 1; i++) {
    results.push(`${database_type.engine}:${i}`);
  }
  return results;
}, [] as string[]);
