import { test } from '@oclif/test';
import path from 'path';
import AuthClient from '../../src/app-config/auth';
import SecretUtils from '../../src/architect/secret/secret.utils';
import { DockerComposeUtils } from '../../src/common/docker-compose';
import DockerBuildXUtils from '../../src/common/docker/buildx.utils';

export const MOCK_API_HOST = 'http://mock.api.localhost';
export const MOCK_APP_HOST = 'http://mock.app.localhost';
export const MOCK_REGISTRY_HOST = 'http://mock.registry.localhost';

export const TMP_DIR = path.join(__dirname, '../tmp');

export const SHARED_COMPONENT_CONTEXT = path.join(__dirname, '../', 'integration', 'hello-world');

export enum MockComponentName {
  HELLO_WORLD = 'hello_world',
  DATABASE_SEEDING = 'database_seeding',
  REACT_APP = 'react_app',
}

const mock_component_configs: Record<MockComponentName, string> = {
  [MockComponentName.HELLO_WORLD]: `name: hello-world
description: A simple hello-world component that returns "Hello World!" on every request.
homepage: https://github.com/architect-team/architect-cli/tree/main/examples/hello-world
keywords:
  - hello-world
  - nodejs
  - architect
  - examples
secrets:
  world_text:
    default: World
services:
  api:
    build:
      context: ../../integration/hello-world
    interfaces:
      main:
        port: 8080
        ingress:
          subdomain: hello
    environment:
      WORLD_TEXT: \${{ secrets.world_text }}`,

  [MockComponentName.DATABASE_SEEDING]: `name: database-seeding
description: Example express application using typeorm to seed test data
homepage: https://github.com/architect-team/architect-cli/tree/main/examples/database-seeding
keywords:
  - architect
  - examples
  - postgres
  - nodejs
  - express-js
secrets:
  auto_ddl:
    description: Options are 'none', 'migrate', and 'seed'; none- no ddl; migrate- runs unrun database migrations at application start; seed- runs unrun migrations and test data seeding script at application start
    default: migrate
  db_user:
    description: Username used to access the database
    default: postgres
  db_pass:
    description: Password used to access the database
    default: architect
  db_name:
    description: Name of the database instance containing the relevant API tables
    default: seeding_demo
services:
  app:
    build:
      context: ../../integration/hello-world
      dockerfile: ../../integration/hello-world/Dockerfile
    interfaces:
      main:
        port: 3000
        ingress:
          subdomain: app
    environment:
      DATABASE_HOST: \${{ services.my-demo-db.interfaces.postgres.host }}
      DATABASE_PORT: \${{ services.my-demo-db.interfaces.postgres.port }}
      DATABASE_USER: \${{ services.my-demo-db.environment.POSTGRES_USER }}
      DATABASE_PASSWORD: \${{ services.my-demo-db.environment.POSTGRES_PASSWORD }}
      DATABASE_SCHEMA: \${{ services.my-demo-db.environment.POSTGRES_DB }}
      AUTO_DDL: \${{ secrets.auto_ddl }}
  my-demo-db:
    image: postgres:11
    interfaces:
      postgres: 5432
    environment:
      POSTGRES_DB: \${{ secrets.db_name }}
      POSTGRES_USER: \${{ secrets.db_user }}
      POSTGRES_PASSWORD: \${{ secrets.db_pass }}`,

  [MockComponentName.REACT_APP]: `name: react-app
description: |
  Example component that includes a Next.js frontend, Node.js backend, and a postgres database.
homepage: https://github.com/architect-team/architect-cli/tree/main/examples/react-app
keywords:
  - react
  - next.js
  - express
  - postgres
secrets:
  api_db_host:
    description: API database host override
    required: false
  db_use_ssl:
    description: Whether or not the database connection should use SSL
    default: false
  api_db_name:
    description: Name of the database used by the API
    default: test_database
  api_host:
    description: API host override
    required: false
  app_replicas:
    description: Number of instances of the react frontend
    default: 1
  root_db_pass:
    description: Root password to assign to the generated database
    default: architect
  root_db_user:
    description: Root user to assign to the generated database
    default: postgres
  world_text:
    description: Default greeting text for the landing page
    default: world
services:
  api-db:
    image: postgres:11
    interfaces:
      postgres:
        host: \${{ secrets.api_db_host }}
        port: 5432
        username: \${{ secrets.root_db_user }}
        password: \${{ secrets.root_db_pass }}
        protocol: postgres
    environment:
      POSTGRES_USER: \${{ secrets.root_db_user }}
      POSTGRES_PASSWORD: \${{ secrets.root_db_pass }}
      POSTGRES_DB: \${{ secrets.api_db_name }}
  api:
    depends_on:
      - api-db
    build:
      context: ../../integration/hello-world
      args:
        NODE_ENV: production
    interfaces:
      main:
        host: \${{ secrets.api_host }}
        port: 8080
    liveness_probe:
      command: curl --fail localhost:\${{ services.api.interfaces.main.port }}/names
      interval: 10s
      failure_threshold: 3
    environment:
      PORT: \${{ services.api.interfaces.main.port }}
      DB_USE_SSL: \${{ secrets.db_use_ssl }}
      DB_ADDR: \${{ services.api - db.interfaces.postgres.url }}/\${{ secrets.api_db_name }}
    debug:
      command: npm run start:dev
      build:
        args:
          NODE_ENV: development
      volumes:
        src:
          mount_path: /usr/src/app
          host_path: ../../integration/hello-world
  app:
    depends_on:
      - api
    build:
      context: ../../integration/hello-world
      args:
        NODE_ENV: production
    interfaces:
      main:
        port: &app-port 8080
        ingress:
          subdomain: app
    liveness_probe:
      command: curl --fail localhost:8080/api/names
      interval: 10s
      failure_threshold: 3
    replicas: \${{ secrets.app_replicas }}
    environment:
      PORT: *app-port
      API_ADDR: \${{ services.api.interfaces.main.url }}
      WORLD_TEXT: \${{ secrets.world_text }}
    debug:
      build:
        context: ../../integration/hello-world
        dockerfile: ../../integration/hello-world/Dockerfile
        args:
          NODE_ENV: development
      volumes:
        src:
          mount_path: /usr/src/app
          host_path: ../../integration/hello-world`,
};

const mock_project_paths: Record<MockComponentName, string> = {
  [MockComponentName.HELLO_WORLD]: path.join(__dirname, '../', 'integration', 'hello-world', 'architect.yml'),
  [MockComponentName.REACT_APP]: path.join(__dirname, '../', 'mocks', 'examples', 'react-app.architect.yml'),
  [MockComponentName.DATABASE_SEEDING]: path.join(__dirname, '../', 'mocks', 'examples', 'database-seeding.architect.yml'),
};

interface MockComponent {
  CONFIG: string;
  CONFIG_FILE_PATH: string;
}

export const mock_components: Record<MockComponentName, MockComponent> = {
  [MockComponentName.HELLO_WORLD]: {
    CONFIG: mock_component_configs[MockComponentName.HELLO_WORLD].trim(),
    CONFIG_FILE_PATH: mock_project_paths[MockComponentName.HELLO_WORLD],
  },
  [MockComponentName.DATABASE_SEEDING]: {
    CONFIG: mock_component_configs[MockComponentName.DATABASE_SEEDING].trim(),
    CONFIG_FILE_PATH: mock_project_paths[MockComponentName.DATABASE_SEEDING],
  },
  [MockComponentName.REACT_APP]: {
    CONFIG: mock_component_configs[MockComponentName.REACT_APP].trim(),
    CONFIG_FILE_PATH: mock_project_paths[MockComponentName.REACT_APP],
  },
};

export const mockArchitectAuth = () =>
  test
    .stub(AuthClient.prototype, 'init', () => { })
    .stub(AuthClient.prototype, 'loginFromCli', () => { })
    .stub(AuthClient.prototype, 'generateBrowserUrl', () => {
 return 'http://mockurl.com';
})
    .stub(AuthClient.prototype, 'loginFromBrowser', () => { })
    .stub(AuthClient.prototype, 'logout', () => { })
    .stub(AuthClient.prototype, 'dockerLogin', () => { })
    .stub(AuthClient.prototype, 'getToken', () => {
      return {
        account: 'test-user',
        password: 'test-password',
      };
    })
    .stub(AuthClient.prototype, 'refreshToken', () => { })
    .stub(DockerComposeUtils, 'dockerCompose', () => { })
    .stub(DockerComposeUtils, 'writeCompose', () => { })
    .stub(DockerBuildXUtils, 'writeBuildkitdConfigFile', () => { })
    .stub(DockerBuildXUtils, 'dockerBuildX', () => { })
    .stub(DockerBuildXUtils, 'getBuilder', () => { })
    .stub(SecretUtils, 'getSecrets', () => [])
    .stub(SecretUtils, 'batchUpdateSecrets', () => [])
    .stub(DockerBuildXUtils, 'convertToBuildxPlatforms', () => { });
