import { expect, test } from '@oclif/test';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import sinon from 'sinon';
import { buildSpecFromYml, ComponentConfig, resourceRefToNodeRef } from '../../../src';
import AppService from '../../../src/app-config/service';
import AccountUtils from '../../../src/architect/account/account.utils';
import SecretUtils from '../../../src/architect/secret/secret.utils';
import Dev, { UpProcessManager } from '../../../src/commands/dev';
import { DockerUtils } from '../../../src/common/docker';
import { DockerComposeUtils } from '../../../src/common/docker-compose';
import DockerComposeTemplate from '../../../src/common/docker-compose/template';
import { DockerHelper } from '../../../src/common/docker/helper';
import PluginManager from '../../../src/common/plugins/plugin-manager';
import DeployUtils from '../../../src/common/utils/deploy.utils';
import * as ComponentBuilder from '../../../src/dependency-manager/spec/utils/component-builder';
import { getMockComponentContextPath, getMockComponentFilePath, MOCK_API_HOST } from '../../utils/mocks';

// set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
const print = false;

const account = {
  id: 'test-account-id',
  name: 'examples',
};

describe('local dev environment', function () {
  function getHelloComponentConfig(): any {
    return `
    name: hello-world

    secrets:
      hello_ingress: hello

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main:
            port: 3000
        environment: {}
        liveness_probe:
          command: curl --fail localhost:3000

    interfaces:
      hello:
        ingress:
          subdomain: \${{ secrets.hello_ingress }}
        url: \${{ services.api.interfaces.main.url }}
    `;
  }

  function getHelloComponentConfigWithPortPathHealthcheck(): any {
    return `
    name: hello-world

    secrets:
      hello_ingress: hello

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main:
            port: 3000
        environment: {}
        liveness_probe:
          port: 3000
          path: /status

    interfaces:
      hello:
        ingress:
          subdomain: \${{ secrets.hello_ingress }}
        url: \${{ services.api.interfaces.main.url }}
    `;
  }

  const local_component_config_with_secrets = `
    name: hello-world

    secrets:
      a_required_key:
        required: true
      another_required_key:
        required: true
      one_more_required_secret:
        required: true
      compose_escaped_variable:
        required: false
      api_port:

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          hello:
            port: \${{ secrets.api_port }}
            ingress:
              subdomain: hello
        environment:
          a_required_key: \${{ secrets.a_required_key }}
          another_required_key: \${{ secrets.another_required_key }}
          one_more_required_secret: \${{ secrets.one_more_required_secret }}
          compose_escaped_variable: \${{ secrets.compose_escaped_variable }}
    `;

  const local_component_config_with_environment_secret = `
    name: hello-world

    secrets:
      a_required_key:
        required: true

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          a_required_key: \${{ secrets.a_required_key }}

    interfaces:
      hello:
        url: \${{ services.api.interfaces.main.url }}
    `;

  const basic_secrets = {
    'hello-world': {
      'a_required_key': 'some_value',
      'another_required_key': 'required_value',
      'one_more_required_secret': 'one_more_value',
      'compose_escaped_variable': 'variable_split_$_with_dollar$signs',
      'api_port': 3000,
    },
  };
  const wildcard_secrets = {
    'hello-world': {
      'a_required_key': 'some_value',
      'api_port': 3000,
      'one_more_required_secret': 'one_more_value',
    },
    '*': {
      'another_required_key': 'required_value',
    },
  };
  const dotenv_wildcard_secrets = {
    '*': {
      'a_required_key': 'some_value',
      'another_required_key': 'required_value',
      'one_more_required_secret': 'one_more_value',
      'compose_escaped_variable': 'variable_split_$_with_dollar$signs',
      'api_port': 3000,
    },
  };
  const stacked_secrets = {
    'hello-world': {
      'a_required_key': 'some_value',
      'another_required_key': 'required_value',
      'one_more_required_secret': 'one_more_value',
      'api_port': 3000,
    },
    '*': {
      'a_required_key': 'a_value_which_will_be_overwritten',
      'another_required_key': 'another_value_which_will_be_overwritten',
    },
  };

  const environment_secrets = [
    {
      key: 'a_required_key',
      value: 'env_value',
      scope: '*',
    },
  ];

  const local_component_config_with_dependency = {
    'name': 'hello-world',

    'services': {
      'api': {
        'image': 'heroku/nodejs-hello-world',
        'interfaces': {
          'main': {
            'port': 3000,
            'ingress': {
              'subdomain': 'hello',
            },
          },
        },
        'environment': {
          'a_required_key': '${{ secrets.a_required_key }}',
          'another_required_key': '${{ secrets.another_required_key }}',
          'one_more_required_secret': '${{ secrets.one_more_required_secret }}',
        },
      },
    },

    'secrets': {
      'a_required_key': {
        'required': true,
      },
      'another_required_key': {
        'required': true,
      },
      'one_more_required_secret': {
        'required': true,
      },
    },

    'dependencies': {
      'react-app': 'latest',
    },
  };
  const local_component_config_dependency = {
    'config': {
      'name': 'react-app',
      'interfaces': {
        'app': '\${{ services.app.interfaces.main.url }}',
      },
      'secrets': {
        'world_text': {
          'default': 'world',
        },
      },
      'services': {
        'app': {
          'build': {
            'context': getMockComponentContextPath('react-app'),
          },
          'interfaces': {
            'main': 8080,
          },
          'environment': {
            'PORT': '\${{ services.app.interfaces.main.port }}',
            'WORLD_TEXT': '\${{ secrets.world_text }}',
          },
        },
      },
    },
    'tag': 'latest',
  };
  const component_and_dependency_secrets = {
    'hello-world': {
      'a_required_key': 'some_value',
      'another_required_key': 'required_value',
      'one_more_required_secret': 'one_more_value',
    },
    '*': {
      'a_required_key': 'a_value_which_will_be_overwritten',
      'another_required_key': 'another_value_which_will_be_overwritten',
      'world_text': 'some other name',
      'unused_secret': 'value_not_used_by_any_component',
    },
  };

  const local_database_seeding_component_config = {
    'name': 'database-seeding',

    'secrets': {
      'AUTO_DDL': {
        'default': 'none',
      },
      'DB_USER': {
        'default': 'postgres',
      },
      'DB_PASS': {
        'default': 'architect',
      },
      'DB_NAME': {
        'default': 'seeding_demo',
      },
    },

    'services': {
      'app': {
        'build': {
          'context': getMockComponentContextPath('database-seeding'),
          'dockerfile': './Dockerfile',
          'target': 'production',
        },
        'interfaces': {
          'main': {
            'port': 3000,
            'ingress': {
              'subdomain': 'app',
            },
          },
        },
        'depends_on': ['my-demo-db'],
        'environment': {
          'DATABASE_HOST': '${{ services.my-demo-db.interfaces.postgres.host }}',
          'DATABASE_PORT': '${{ services.my-demo-db.interfaces.postgres.port }}',
          'DATABASE_USER': '${{ services.my-demo-db.environment.POSTGRES_USER }}',
          'DATABASE_PASSWORD': '${{ services.my-demo-db.environment.POSTGRES_PASSWORD }}',
          'DATABASE_SCHEMA': '${{ services.my-demo-db.environment.POSTGRES_DB }}',
          'AUTO_DDL': '${{ secrets.AUTO_DDL }}',
        },
      },

      'my-demo-db': {
        'image': 'postgres:11',
        'interfaces': {
          'postgres': 5432,
        },
        'environment': {
          'POSTGRES_DB': '${{ secrets.DB_NAME }}',
          'POSTGRES_USER': '${{ secrets.DB_USER }}',
          'POSTGRES_PASSWORD': '${{ secrets.DB_PASS }}',
        },
      },
    },
  };

  const seed_app_resource_ref = 'database-seeding.services.app'
  const seed_app_ref = resourceRefToNodeRef(seed_app_resource_ref);
  const seed_db_ref = resourceRefToNodeRef('database-seeding.services.my-demo-db');

  const seeding_component_expected_compose: DockerComposeTemplate = {
    'version': '3',
    'services': {
      [seed_app_ref]: {
        'ports': [
          '50000:3000',
        ],
        depends_on: {
          [seed_db_ref]: {
            condition: 'service_started'
          }
        },
        'environment': {
          'DATABASE_HOST': seed_db_ref,
          'DATABASE_PORT': '5432',
          'DATABASE_USER': 'postgres',
          'DATABASE_PASSWORD': 'architect',
          'DATABASE_SCHEMA': 'test-db',
          'AUTO_DDL': 'seed',
        },
        'labels': [
          `architect.ref=${seed_app_resource_ref}`,
          'traefik.enable=true',
          'traefik.port=80',
          `traefik.http.routers.${seed_app_ref}-main.rule=Host(\`app.arc.localhost\`)`,
          `traefik.http.routers.${seed_app_ref}-main.service=${seed_app_ref}-main-service`,
          `traefik.http.services.${seed_app_ref}-main-service.loadbalancer.server.port=3000`,
        ],
        'build': {
          'context': getMockComponentContextPath('database-seeding'),
          'dockerfile': './Dockerfile',
          'target': 'production',
        },
        'image': seed_app_ref,
        'external_links': [
          'gateway:app.arc.localhost',
        ],
      },
      [seed_db_ref]: {
        'ports': [
          '50001:5432',
        ],
        'environment': {
          'POSTGRES_DB': 'test-db',
          'POSTGRES_USER': 'postgres',
          'POSTGRES_PASSWORD': 'architect',
        },
        'image': 'postgres:11',
        'external_links': [
          'gateway:app.arc.localhost',
        ],
        labels: ['architect.ref=database-seeding.services.my-demo-db'],
      },
      'gateway': {
        'image': 'traefik:v2.9.8',
        'command': [
          '--api.insecure=true',
          '--pilot.dashboard=false',
          '--accesslog=true',
          '--accesslog.filters.minDuration=1s',
          '--accesslog.filters.statusCodes=400-599',
          '--entryPoints.web.address=:80',
          '--providers.docker=true',
          '--providers.docker.allowEmptyServices=true',
          '--providers.docker.exposedByDefault=false',
          '--providers.docker.constraints=Label(`traefik.port`,`80`)',
        ],
        'ports': [
          '80:80',
          '8080:8080',
        ],
        'volumes': [
          '/var/run/docker.sock:/var/run/docker.sock:ro',
        ],
      },
    },
    'volumes': {},
  };

  const resource_ref = 'hello-world.services.api';
  const hello_api_ref = resourceRefToNodeRef(resource_ref);
  const component_expected_compose: DockerComposeTemplate = {
    'version': '3',
    'services': {
      [hello_api_ref]: {
        'ports': [
          '50000:3000',
        ],
        'environment': {},
        'labels': [
          `architect.ref=${resource_ref}`,
          'traefik.enable=true',
          'traefik.port=80',
          `traefik.http.routers.${hello_api_ref}-hello.rule=Host(\`hello.arc.localhost\`)`,
          `traefik.http.routers.${hello_api_ref}-hello.service=${hello_api_ref}-hello-service`,
          `traefik.http.services.${hello_api_ref}-hello-service.loadbalancer.server.port=3000`,
        ],
        'external_links': [
          'gateway:hello.arc.localhost',
        ],
        'image': 'heroku/nodejs-hello-world',
        'healthcheck': {
          'test': [
            'CMD', 'curl', '--fail', 'localhost:3000',
          ],
          'interval': '30s',
          'timeout': '5s',
          'retries': 3,
          'start_period': '0s',
        },
      },
      'gateway': {
        'image': 'traefik:v2.9.8',
        'command': [
          '--api.insecure=true',
          '--pilot.dashboard=false',
          '--accesslog=true',
          '--accesslog.filters.minDuration=1s',
          '--accesslog.filters.statusCodes=400-599',
          '--entryPoints.web.address=:80',
          '--providers.docker=true',
          '--providers.docker.allowEmptyServices=true',
          '--providers.docker.exposedByDefault=false',
          '--providers.docker.constraints=Label(`traefik.port`,`80`)',
        ],
        'ports': [
          '80:80',
          '8080:8080',
        ],
        'volumes': [
          '/var/run/docker.sock:/var/run/docker.sock:ro',
        ],
      },
    },
    'volumes': {},
  };

  const ssl_component_expected_compose: DockerComposeTemplate = {
    'version': '3',
    'services': {
      [hello_api_ref]: {
        'ports': [
          '50000:3000',
        ],
        'environment': {},
        'labels': [
          `architect.ref=${resource_ref}`,
          'traefik.enable=true',
          'traefik.port=443',
          `traefik.http.routers.${hello_api_ref}-hello.rule=Host(\`hello.localhost.architect.sh\`)`,
          `traefik.http.routers.${hello_api_ref}-hello.service=${hello_api_ref}-hello-service`,
          `traefik.http.services.${hello_api_ref}-hello-service.loadbalancer.server.port=3000`,
          'traefik.http.routers.hello-world--api-hello.entrypoints=web',
          'traefik.http.routers.hello-world--api-hello.tls=true',
        ],
        'external_links': [
          'gateway:hello.localhost.architect.sh',
        ],
        'image': 'heroku/nodejs-hello-world',
        'healthcheck': {
          'test': [
            'CMD', 'curl', '--fail', 'localhost:3000',
          ],
          'interval': '30s',
          'timeout': '5s',
          'retries': 3,
          'start_period': '0s',
        },
      },
      'gateway': {
        'image': 'traefik:v2.9.8',
        'command': [
          '--api.insecure=true',
          '--pilot.dashboard=false',
          '--accesslog=true',
          '--accesslog.filters.minDuration=1s',
          '--accesslog.filters.statusCodes=400-599',
          '--entryPoints.web.address=:443',
          '--providers.docker=true',
          '--providers.docker.allowEmptyServices=true',
          '--providers.docker.exposedByDefault=false',
          '--providers.docker.constraints=Label(`traefik.port`,`443`)',
          '--serversTransport.insecureSkipVerify=true',
          '--entryPoints.web.http.redirections.entryPoint.scheme=https',
          '--entryPoints.web.http.redirections.entryPoint.permanent=true',
          '--entryPoints.web.http.redirections.entryPoint.to=:443',
          '--providers.file.watch=false',
          '--providers.file.fileName=/etc/traefik.yaml',
        ],
        'ports': [
          '443:443',
          '8080:8080',
        ],
        'volumes': [
          '/var/run/docker.sock:/var/run/docker.sock:ro',
        ],
        'environment': {
          TRAEFIK_CONFIG: DockerComposeUtils.generateTlsConfig(),
          TRAEFIK_CERT: 'fake-cert',
          TRAEFIK_KEY: 'fake-cert',
        },
      },
    },
    'volumes': {},
  };

  const buildpack_component_expected_compose: DockerComposeTemplate = {
    "version": "3",
    "services": {
      [hello_api_ref]: {
        "ports": [
          "50000:3000",
        ],
        "environment": {
          "WORLD_TEXT": "World"
        },
        "labels": [
          `architect.ref=${resource_ref}`,
          "traefik.enable=true",
          "traefik.port=80",
          `traefik.http.routers.${hello_api_ref}-hello.rule=Host(\`hello.arc.localhost\`)`,
          `traefik.http.routers.${hello_api_ref}-hello.service=${hello_api_ref}-hello-service`,
          `traefik.http.services.${hello_api_ref}-hello-service.loadbalancer.server.port=3000`,
        ],
        "external_links": [
          "gateway:hello.arc.localhost"
        ],
        "image": "hello-world--api",
        "healthcheck": {
          "test": [
            "CMD", "curl", "--fail", "localhost:3000"
          ],
          "interval": "30s",
          "timeout": "5s",
          "retries": 3,
          "start_period": "0s"
        },
      },
      "gateway": {
        "image": "traefik:v2.9.8",
        "command": [
          "--api.insecure=true",
          "--pilot.dashboard=false",
          "--accesslog=true",
          "--accesslog.filters.minDuration=1s",
          "--accesslog.filters.statusCodes=400-599",
          "--entryPoints.web.address=:80",
          "--providers.docker=true",
          "--providers.docker.allowEmptyServices=true",
          "--providers.docker.exposedByDefault=false",
          "--providers.docker.constraints=Label(`traefik.port`,`80`)",
        ],
        "ports": [
          "80:80",
          "8080:8080"
        ],
        "volumes": [
          "/var/run/docker.sock:/var/run/docker.sock:ro"
        ]
      }
    },
    "volumes": {}
  }

  const buildpack_dockerfile_component_expected_compose: DockerComposeTemplate = {
    "version": "3",
    "services": {
      "hello-world--buildpack-api": {
        "ports": [
          "50000:3000",
        ],
        "environment": {
          "WORLD_TEXT": "World"
        },
        "labels": [
          "architect.ref=hello-world.services.buildpack-api",
          "traefik.enable=true",
          "traefik.port=80",
          "traefik.http.routers.hello-world--buildpack-api-hello.rule=Host(`buildpack-api.arc.localhost`)",
          "traefik.http.routers.hello-world--buildpack-api-hello.service=hello-world--buildpack-api-hello-service",
          "traefik.http.services.hello-world--buildpack-api-hello-service.loadbalancer.server.port=3000",
        ],
        "external_links": [
          "gateway:buildpack-api.arc.localhost",
          "gateway:dockerfile-api.arc.localhost"
        ],
        "image": "hello-world--buildpack-api",
        "healthcheck": {
          "test": [
            "CMD", "curl", "--fail", "localhost:3000"
          ],
          "interval": "30s",
          "timeout": "5s",
          "retries": 3,
          "start_period": "0s"
        },
      },
      "hello-world--dockerfile-api": {
        "build": {
          "context": path.resolve("./test/integration/hello-world"),
          "tags": [
            "hello-world--dockerfile-api",
            "hello-world--dockerfile-api2"
          ]
        },
        "ports": [
          "50001:4000",
        ],
        "environment": {
          "WORLD_TEXT": "World"
        },
        "labels": [
          "architect.ref=hello-world.services.dockerfile-api",
          "traefik.enable=true",
          "traefik.port=80",
          "traefik.http.routers.hello-world--dockerfile-api-hello.rule=Host(`dockerfile-api.arc.localhost`)",
          "traefik.http.routers.hello-world--dockerfile-api-hello.service=hello-world--dockerfile-api-hello-service",
          "traefik.http.services.hello-world--dockerfile-api-hello-service.loadbalancer.server.port=4000",
        ],
        "external_links": [
          "gateway:buildpack-api.arc.localhost",
          "gateway:dockerfile-api.arc.localhost"
        ],
        "image": "hello-world--dockerfile-api",
        "healthcheck": {
          "test": [
            "CMD", "curl", "--fail", "localhost:4000"
          ],
          "interval": "30s",
          "timeout": "5s",
          "retries": 3,
          "start_period": "0s"
        },
      },
      "hello-world--dockerfile-api2": {
        "environment": {},
        "external_links": [
          "gateway:buildpack-api.arc.localhost",
          "gateway:dockerfile-api.arc.localhost"
        ],
        "image": "hello-world--dockerfile-api2",
        "labels": [
          "architect.ref=hello-world.services.dockerfile-api2"
        ]
      },
      "hello-world--redis": {
        "environment": {},
        "external_links": [
          "gateway:buildpack-api.arc.localhost",
          "gateway:dockerfile-api.arc.localhost"
        ],
        "image": "redis",
        "labels": [
          "architect.ref=hello-world.services.redis"
        ]
      },
      "gateway": {
        "image": "traefik:v2.9.8",
        "command": [
          "--api.insecure=true",
          "--pilot.dashboard=false",
          "--accesslog=true",
          "--accesslog.filters.minDuration=1s",
          "--accesslog.filters.statusCodes=400-599",
          "--entryPoints.web.address=:80",
          "--providers.docker=true",
          "--providers.docker.allowEmptyServices=true",
          "--providers.docker.exposedByDefault=false",
          "--providers.docker.constraints=Label(`traefik.port`,`80`)",
        ],
        "ports": [
          "80:80",
          "8080:8080"
        ],
        "volumes": [
          "/var/run/docker.sock:/var/run/docker.sock:ro"
        ]
      }
    },
    "volumes": {}
  }

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'loadFile', () => {
      return getHelloComponentConfig();
    })
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world'), '--ssl=false'])
    .it('Create a local dev with a component and an interface', ctx => {
      const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true;
      expect(runCompose.firstCall.args[0]).to.deep.equal(component_expected_compose);
    });

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'loadFile', () => {
      return getHelloComponentConfig();
    })
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'buildImage', sinon.stub().returns(['project_name', 'compose_file']))
    .stub(Dev.prototype, 'setupTraefikServiceMap', sinon.stub().returns({}))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stub(UpProcessManager.prototype, 'run', sinon.stub().returns(undefined))
    .stub(fs, 'removeSync', sinon.stub().returns(null))
    .stub(process, 'exit', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world'), '-d', '--ssl=false'])
    .it(`Run a component locally in detached mode and check that the compose file doesn't get deleted`, ctx => {
      expect(ctx.stdout).to.contain('Starting containers...');

      const remove_sync = fs.removeSync as sinon.SinonStub;
      expect(remove_sync.calledOnce).false;
    });

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'loadFile', () => {
      return getHelloComponentConfig();
    })
    .stub(DockerComposeUtils, 'getLocalEnvironments', sinon.stub().returns([DockerComposeUtils.DEFAULT_PROJECT]))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world'), '--ssl=false'])
    .catch(err => {
      expect(err.message).to.include('Environment name already in use.');
    })
    .it('Provide error if env name exists', ctx => {
      expect(ctx.stdout).to.contain('The environment \`architect\` is already running.');
    });

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'loadFile', () => {
      return getHelloComponentConfig();
    })
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'readSSLCert', sinon.stub().returns('fake-cert'))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world')])
    .it('Create a local dev with a component and an interface with ssl', ctx => {
      const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true;
      delete runCompose.firstCall.args[0].services.gateway.entrypoint;
      expect(runCompose.firstCall.args[0]).to.deep.equal(ssl_component_expected_compose);
    });

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'loadFile', () => {
      const hello_json = yaml.load(getHelloComponentConfig()) as any;
      hello_json.services.api.interfaces.main.sticky = true;
      return yaml.dump(hello_json);
    })
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world'), '--ssl=false'])
    .it('Sticky label added for sticky interfaces', ctx => {
      const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true;
      const hello_api_ref = resourceRefToNodeRef('hello-world.services.api');
      expect(runCompose.firstCall.args[0].services[hello_api_ref].labels).to.contain(`traefik.http.services.${hello_api_ref}-hello-service.loadBalancer.sticky.cookie=true`);
    });

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'buildSpecFromPath', () => {
      const spec = buildSpecFromYml(yaml.dump(local_database_seeding_component_config));
      const component_path = getMockComponentFilePath('database-seeding');
      spec.metadata.file = {
        path: component_path,
        folder: fs.lstatSync(component_path).isFile() ? path.dirname(component_path) : component_path,
        contents: ''
      };
      return spec;
    })
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('database-seeding'), '-s', 'AUTO_DDL=seed', '--secret', 'DB_NAME=test-db', '--ssl=false'])
    .it('Create a local dev with a component, secrets, and an interface', ctx => {
      const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true;
      expect(runCompose.firstCall.args[0]).to.deep.equal(seeding_component_expected_compose);
    });

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'buildSpecFromPath', () => {
      return buildSpecFromYml(local_component_config_with_secrets);
    })
    .stub(DeployUtils, 'readDotEnvSecretsFile', () => {
      return dotenv_wildcard_secrets;
    })
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world'), '--secret-file', './examples/hello-world/.env', '--ssl=false'])
    .it('Create a local dev with a basic component and a basic .env secrets file', ctx => {
      const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true;
      const hello_world_service = runCompose.firstCall.args[0].services[hello_api_ref] as any;
      expect(hello_world_service.external_links).to.contain('gateway:hello.arc.localhost');
      expect(hello_world_service.environment.a_required_key).to.equal('some_value');
      expect(hello_world_service.environment.another_required_key).to.equal('required_value');
      expect(hello_world_service.environment.one_more_required_secret).to.equal('one_more_value');
    });

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'buildSpecFromPath', () => {
      return buildSpecFromYml(local_component_config_with_secrets);
    })
    .stub(DeployUtils, 'readSecretsFile', () => {
      return basic_secrets;
    })
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world'), '--secret-file', './examples/hello-world/secrets.yml', '--ssl=false'])
    .it('Create a local dev with a basic component and a basic secrets file', ctx => {
      const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true;
      const hello_world_service = runCompose.firstCall.args[0].services[hello_api_ref] as any;
      expect(hello_world_service.external_links).to.contain('gateway:hello.arc.localhost');
      expect(hello_world_service.environment.a_required_key).to.equal('some_value');
      expect(hello_world_service.environment.another_required_key).to.equal('required_value');
      expect(hello_world_service.environment.one_more_required_secret).to.equal('one_more_value');
    });

  // This test will be removed when the deprecated 'values' flag is removed
  test
    .timeout(20000)
    .stub(ComponentBuilder, 'buildSpecFromPath', () => {
      return buildSpecFromYml(local_component_config_with_secrets);
    })
    .stub(DeployUtils, 'readSecretsFile', () => {
      return basic_secrets;
    })
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world'), '-v', './examples/hello-world/secrets.yml', '--ssl=false'])
    .it('Create a local dev with a basic component and a basic secrets file using deprecated values flag', ctx => {
      const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true;
      const hello_world_service = runCompose.firstCall.args[0].services[hello_api_ref] as any;
      expect(hello_world_service.external_links).to.contain('gateway:hello.arc.localhost');
      expect(hello_world_service.environment.a_required_key).to.equal('some_value');
      expect(hello_world_service.environment.another_required_key).to.equal('required_value');
      expect(hello_world_service.environment.one_more_required_secret).to.equal('one_more_value');
    });

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'buildSpecFromPath', () => {
      return buildSpecFromYml(local_component_config_with_secrets);
    })
    .stub(DeployUtils, 'readSecretsFile', () => {
      return wildcard_secrets;
    })
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world'), '--secret-file', './examples/hello-world/secrets.yml', '--ssl=false'])
    .it('Create a local dev with a basic component and a wildcard secrets file', ctx => {
      const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
      const hello_world_environment = (runCompose.firstCall.args[0].services[hello_api_ref] as any).environment;
      expect(hello_world_environment.a_required_key).to.equal('some_value');
      expect(hello_world_environment.another_required_key).to.equal('required_value');
      expect(hello_world_environment.one_more_required_secret).to.equal('one_more_value');
    });

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'buildSpecFromPath', () => {
      return buildSpecFromYml(local_component_config_with_secrets);
    })
    .stub(DeployUtils, 'readSecretsFile', () => {
      return stacked_secrets;
    })
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world'), '--secret-file', './examples/hello-world/secrets.yml', '--ssl=false'])
    .it('Create a local dev with a basic component and a stacked secrets file', ctx => {
      const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
      const hello_world_environment = (runCompose.firstCall.args[0].services[hello_api_ref] as any).environment;
      expect(hello_world_environment.a_required_key).to.equal('some_value');
      expect(hello_world_environment.another_required_key).to.equal('required_value');
      expect(hello_world_environment.one_more_required_secret).to.equal('one_more_value');
    });

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'buildSpecFromPath', () => {
      return buildSpecFromYml(yaml.dump(local_component_config_with_dependency));
    })
    .stub(DeployUtils, 'readSecretsFile', () => {
      return component_and_dependency_secrets;
    })
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}`)
      .reply(200, account))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}/components/react-app/versions/latest`)
      .reply(200, local_component_config_dependency))
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world'), '--secret-file', './examples/hello-world/secrets.yml', '-a', 'examples', '--ssl=false'])
    .it('Create a local dev with a basic component, a dependency, and a values file', ctx => {
      const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
      const hello_world_environment = (runCompose.firstCall.args[0].services[hello_api_ref] as any).environment;
      expect(hello_world_environment.a_required_key).to.equal('some_value');
      expect(hello_world_environment.another_required_key).to.equal('required_value');
      expect(hello_world_environment.one_more_required_secret).to.equal('one_more_value');
    });

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'buildSpecFromPath', () => {
      return buildSpecFromYml(yaml.dump(local_component_config_with_dependency));
    })
    .stub(DeployUtils, 'readSecretsFile', () => {
      return component_and_dependency_secrets;
    })
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}`)
      .reply(200, account))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples/components/react-app/versions/latest`)
      .reply(200, local_component_config_dependency))
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world'), '--secret-file', './examples/hello-world/secrets.yml', '-r', '-a', 'examples', '--ssl=false'])
    .it('Create a local recursive dev with a basic component, a dependency, and a secrets file', ctx => {
      const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
      const hello_world_environment = (runCompose.firstCall.args[0].services[hello_api_ref] as any).environment;
      const react_app_ref = resourceRefToNodeRef('react-app.services.app');
      const react_app_environment = (runCompose.firstCall.args[0].services[react_app_ref] as any).environment;
      expect(hello_world_environment.a_required_key).to.equal('some_value');
      expect(hello_world_environment.another_required_key).to.equal('required_value');
      expect(hello_world_environment.one_more_required_secret).to.equal('one_more_value');
      expect(react_app_environment.WORLD_TEXT).to.equal('some other name');
    });

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'buildSpecFromPath', () => {
      return buildSpecFromYml(local_component_config_with_secrets);
    })
    .stub(DeployUtils, 'readSecretsFile', () => {
      return basic_secrets;
    })
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world'), '--secret-file', './examples/hello-world/secrets.yml', '--ssl=false'])
    .it('Dollar signs are escaped for environment variables in local compose devments', ctx => {
      const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true;
      const hello_world_service = runCompose.firstCall.args[0].services[hello_api_ref] as any;
      expect(hello_world_service.environment.compose_escaped_variable).to.equal('variable_split_$$_with_dollar$$signs');
    });

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'buildSpecFromPath', () => {
      return buildSpecFromYml(local_component_config_with_environment_secret);
    })
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}`)
      .reply(200, account)
      .persist())
    .stub(SecretUtils, 'getSecrets', () => {
      return environment_secrets;
    })
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world'), '-i', 'test:hello', '--secrets-env=env', '-a', 'examples', '--ssl=false'])
    .it('Create a local dev with a basic component and an environment secret', ctx => {
      const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true;
      const hello_world_environment = (runCompose.firstCall.args[0].services[hello_api_ref] as any).environment;
      expect(hello_world_environment.a_required_key).to.equal('env_value');
    });

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'buildSpecFromPath', () => {
      return buildSpecFromYml(local_component_config_with_environment_secret);
    })
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}`)
      .reply(200, account)
      .persist())
    .stub(DeployUtils, 'readSecretsFile', () => {
      return basic_secrets;
    })
    .stub(SecretUtils, 'getSecrets', () => {
      return environment_secrets;
    })
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world'), '-i', 'test:hello', '--secret-file', './examples/hello-world/secrets.yml', '--secrets-env=env', '-a', 'examples', '--ssl=false'])
    .it('Create a local dev with a basic component, a secret file, and an overwritten environment secret', ctx => {
      const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true;
      const hello_world_environment = (runCompose.firstCall.args[0].services[hello_api_ref] as any).environment;
      expect(hello_world_environment.a_required_key).to.equal('some_value');
    });

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'buildSpecFromPath', () => {
      return buildSpecFromYml(local_component_config_with_environment_secret);
    })
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}`)
      .reply(200, account)
      .persist())
    .stub(SecretUtils, 'getSecrets', sinon.stub().throws(new Error(`Could not find entity of type "Environment"`)))
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world'), '-i', 'test:hello', '--secrets-env=non-existent-env', '-a', 'examples', '--ssl=false'])
    .catch(err => {
      expect(process.exitCode).eq(1);
      expect(`${err}`).to.contain(`Could not find entity of type "Environment"`);
    })
    .it('Throw an error when the environment to pull secrets from does not exist');

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'buildSpecFromPath', () => {
      return buildSpecFromYml(local_component_config_with_environment_secret);
    })
    .stub(AccountUtils, 'getAccount', () => {
      return account;
    })
    .stub(SecretUtils, 'getSecrets', () => {
      return environment_secrets;
    })
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world'), '-i', 'test:hello', '--secrets-env=env', '--ssl=false'])
    .it('Get an account if not provided to pull secrets from an environment', ctx => {
      const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true;
      const hello_world_environment = (runCompose.firstCall.args[0].services[hello_api_ref] as any).environment;
      expect(hello_world_environment.a_required_key).to.equal('env_value');
    });

  describe('linked dev', function () {
    test
      .timeout(20000)
      .stub(ComponentBuilder, 'buildSpecFromPath', () => {
        return buildSpecFromYml(getHelloComponentConfig());
      })
      .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
      .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
      .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
      .stub(AppService.prototype, 'loadLinkedComponents', sinon.stub().returns({ 'hello-world': getMockComponentFilePath('hello-world') }))
      .stdout({ print })
      .stderr({ print })
      .command(['dev', 'hello-world:latest', '--ssl=false'])
      .it('Create a local dev with a component and an interface', ctx => {
        const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
        expect(runCompose.calledOnce).to.be.true;
        expect(runCompose.firstCall.args[0]).to.deep.equal(component_expected_compose);
      });
  });

  describe('instance devs', function () {
    const hello_api_instance_ref = resourceRefToNodeRef('hello-world.services.api@tenant-1');
    const expected_instance_compose = JSON.parse(JSON.stringify(component_expected_compose).replace(new RegExp(hello_api_ref, 'g'), hello_api_instance_ref).replace(new RegExp('hello-world.services.api', 'g'), 'hello-world.services.api@tenant-1'));

    const local_dev = test
      .timeout(20000)
      // @ts-ignore
      .stub(ComponentBuilder, 'buildSpecFromPath', (_, metadata) => {
        return buildSpecFromYml(getHelloComponentConfig(), metadata);
      })
      .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
      .stub(AppService.prototype, 'loadLinkedComponents', sinon.stub().returns({ 'hello-world': getMockComponentFilePath('hello-world') }))
      .stdout({ print })
      .stderr({ print });

    local_dev
      .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
      .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
      .command(['dev', 'hello-world@tenant-1', '--ssl=false'])
      .it('Create a local dev with instance id and no tag', ctx => {
        const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
        expect(runCompose.calledOnce).to.be.true;
        expect(runCompose.firstCall.args[0]).to.deep.equal(expected_instance_compose);
      });

    local_dev
      .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
      .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
      .command(['dev', 'hello-world:latest@tenant-1', '--ssl=false'])
      .it('Create a local dev with instance name and tag', ctx => {
        const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
        expect(runCompose.calledOnce).to.be.true;
        expect(runCompose.firstCall.args[0]).to.deep.equal(expected_instance_compose);
      });

    local_dev
      .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
      .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
      // @ts-ignore
      .stub(ComponentBuilder, 'buildSpecFromPath', (_, metadata) => {
        const hello_json = yaml.load(getHelloComponentConfig()) as any;
        hello_json.services.api.environment.SELF_URL = `\${{ services.api.interfaces.hello.ingress.url }}`;
        return buildSpecFromYml(yaml.dump(hello_json), metadata);
      })
      .stub(DeployUtils, 'readSecretsFile', () => {
        return {
          'hello-world:latest@tenant-1': {
            'hello_ingress': 'hello-app',
          },
        };
      })
      .command(['dev', '--secret-file', './examples/hello-world/secrets.yml', 'hello-world:latest@tenant-1', '--ssl=false'])
      .it('Create a local dev with instance name, tag, and secret file', ctx => {
        const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
        expect(runCompose.calledOnce).to.be.true;
        const tenant_1_ref = resourceRefToNodeRef('hello-world.services.api@tenant-1');
        const compose = runCompose.firstCall.args[0];
        expect(Object.keys(compose.services)).includes(tenant_1_ref);
        expect(compose.services[tenant_1_ref].labels || []).includes(`traefik.http.routers.${tenant_1_ref}-hello.rule=Host(\`hello-app.arc.localhost\`)`);
      });

    local_dev
      .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
      .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
      // @ts-ignore
      .stub(ComponentBuilder, 'buildSpecFromPath', (_, metadata) => {
        const hello_json = yaml.load(getHelloComponentConfig()) as any;
        hello_json.services.api.environment.SELF_URL = `\${{ services.api.interfaces.hello.ingress.url }}`;
        return buildSpecFromYml(yaml.dump(hello_json), metadata);
      })
      .stub(DeployUtils, 'readSecretsFile', () => {
        return {
          'hello-world@tenant-1': {
            'hello_ingress': 'hello-1',
          },
          'hello-world@tenant-2': {
            'hello_ingress': 'hello-2',
          },
        };
      })
      .command(['dev', '--secret-file', './examples/hello-world/secrets.yml', 'hello-world@tenant-1', 'hello-world@tenant-2', '--ssl=false'])
      .it('Create a local dev with multiple instances of the same component', ctx => {
        const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
        expect(runCompose.calledOnce).to.be.true;

        const tenant_1_ref = resourceRefToNodeRef('hello-world.services.api@tenant-1');
        const tenant_2_ref = resourceRefToNodeRef('hello-world.services.api@tenant-2');

        const compose = runCompose.firstCall.args[0];
        expect(Object.keys(compose.services)).includes(tenant_1_ref, tenant_2_ref);
        expect(compose.services[tenant_1_ref].labels || []).includes(`traefik.http.routers.${tenant_1_ref}-hello.rule=Host(\`hello-1.arc.localhost\`)`);
        expect(compose.services[tenant_2_ref].labels || []).includes(`traefik.http.routers.${tenant_2_ref}-hello.rule=Host(\`hello-2.arc.localhost\`)`);
      });
  });

  describe('ingresses devs', function () {
    test
      .timeout(20000)
      // @ts-ignore
      .stub(ComponentBuilder, 'buildSpecFromPath', (path: string) => {
        let config: string;
        if (path === getMockComponentFilePath('react-app')) {
          config = `
          name: auth
          services:
            auth:
              interfaces:
                main: 8080
              environment:
                SELF_URL: \${{ ingresses.auth.url }} # is not auto-exposed
                OLD_SELF_URL: \${{ environment.ingresses['auth'].auth.url }} # is not auto-exposed
          interfaces:
            auth:
              url: \${{ services.auth.interfaces.main.url }}
              ingress:
                enabled: true
          `;
        } else {
          config = `
          name: app
          dependencies:
            auth: latest
          services:
            app:
              interfaces:
                main: 8080
              environment:
                SELF_URL: \${{ ingresses.app.url }} # successfully auto-exposed as an ingress
                OLD_SELF_URL: \${{ environment.ingresses['app'].app.url }} # successfully auto-exposed as an ingress
                DEPENDENCY_URL: \${{ dependencies['auth'].ingresses.auth.url }} # is not auto-exposed
          interfaces:
            app:
              url: \${{ services.app.interfaces.main.url }}
              ingress:
                enabled: true
          `;
        }
        return buildSpecFromYml(config);
      })
      .stub(AppService.prototype, 'loadLinkedComponents', sinon.stub().returns({
        'app': getMockComponentFilePath('hello-world'),
        'auth': getMockComponentFilePath('react-app'),
      }))
      .stdout({ print })
      .stderr({ print })
      .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
      .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
      .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
      .command(['dev', 'app', '--ssl=false'])
      .it('Dev component with dependency with ingresses', ctx => {
        const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
        expect(runCompose.calledOnce).to.be.true;
        const compose = runCompose.firstCall.args[0];
        const app_ref = resourceRefToNodeRef('app.services.app');
        expect(compose.services[app_ref].labels).includes('traefik.enable=true');
        const auth_ref = resourceRefToNodeRef('auth.services.auth');
        expect(compose.services[auth_ref].labels).includes('traefik.enable=true');
      });
  });

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'loadFile', () => {
      return getHelloComponentConfig();
    })
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world'), '--ssl=false'])
    .it('Command with an operator is converted correctly to the docker compose file', ctx => {
      const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
      const compose = runCompose.firstCall.args[0];
      expect(runCompose.calledOnce).to.be.true;
      expect(compose.services['hello-world--api'].healthcheck).to.deep.equal({
        'test': [
          'CMD', 'curl', '--fail', 'localhost:3000',
        ],
        'interval': '30s',
        'timeout': '5s',
        'retries': 3,
        'start_period': '0s',
      });
    });

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'loadFile', () => {
      return getHelloComponentConfigWithPortPathHealthcheck();
    })
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'readSSLCert', sinon.stub().returns('fake-cert'))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world')])
    .it('Path/port healthcheck converted to http path', ctx => {
      const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
      const compose = runCompose.firstCall.args[0];
      expect(runCompose.calledOnce).to.be.true;
      expect(compose.services['hello-world--api'].healthcheck).to.deep.equal({
        'test': [
          'CMD-SHELL',
          'curl -f http://localhost:3000/status || exit 1',
        ],
        'interval': '30s',
        'timeout': '5s',
        'retries': 3,
        'start_period': '0s',
      });
    });

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'loadFile', () => {
      const config = yaml.load(getHelloComponentConfig()) as ComponentConfig;
      delete config.services.api.image;
      config.services.api.build = {
        context: 'non_existent_path',
      };
      return yaml.dump(config);
    })
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world'), '--ssl=false'])
    .catch(err => {
      expect(err.message).to.include('non_existent_path');
      expect(err.message).to.include('used for the build context of service api does not exist.');
    })
    .it(`Throws error if a path is given that doesn't exist`, ctx => {
      const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.false;
    });

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'loadFile', () => {
      return '';
    })
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'readSSLCert', sinon.stub().returns('fake-cert'))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world')])
    .catch(err => {
      expect(err.message).to.include('For help getting started take a look at our documentation here: https://docs.architect.io/reference/architect-yml');
    })
    .it('Provide error if architect.yml is empty');

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'loadFile', () => {
      return fs.readFileSync('./test/mocks/buildpack/buildpack-architect.yml').toString();
    })
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stub(PluginManager, 'getPlugin', sinon.stub().returns({
      build: () => { },
    }))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', './test/mocks/buildpack/buildpack-architect.yml', '--ssl=false'])
    .it('Dev component with buildpack', ctx => {
      const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true
      expect(runCompose.firstCall.args[0]).to.deep.equal(buildpack_component_expected_compose)
    });

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'loadFile', () => {
      return fs.readFileSync('./test/mocks/buildpack/buildpack-dockerfile-architect.yml').toString();
    })
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stub(PluginManager, 'getPlugin', sinon.stub().returns({
      build: () => { },
    }))
    .stub(DockerHelper, 'composeVersion', sinon.stub().returns(true))
    .stub(DockerHelper, 'buildXVersion', sinon.stub().returns(true))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', './test/mocks/buildpack/buildpack-dockerfile-architect.yml', '--ssl=false'])
    .it('Dev component with buildpack and dockerfile services', ctx => {
      const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true
      expect(runCompose.firstCall.args[0]).to.deep.equal(buildpack_dockerfile_component_expected_compose)
    });

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'loadFile', () => {
      return fs.readFileSync('test/mocks/register/nonexistence-dockerfile-architect.yml').toString();
    })
    .stub(DockerUtils, 'doesDockerfileExist', sinon.stub().callsFake(DockerUtils.doesDockerfileExist)) // override global stub
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', './test/mocks/register/nonexistence-dockerfile-architect.yml', '--ssl=false'])
    .catch(e => {
      expect(e.message).contains(`${path.resolve('./test/integration/hello-world/nonexistent-dockerfile')} does not exist. Please verify the correct context and/or dockerfile were given.`);
    })
    .it('Dev component fail with a dockerfile that does not exist');

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'loadFile', () => {
      return getHelloComponentConfig();
    })
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .nock('https://storage.googleapis.com', api => api.get('/architect-ci-ssl/fullchain.pem').reply(500))
    .nock('https://storage.googleapis.com', api => api.get('/architect-ci-ssl/privkey.pem').reply(500))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world')])
    .catch(e => {
      expect(e.message).contains(`--ssl=false`);
    })
    .it('Show helpful error msg if dev fails without internet connection.');

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'buildSpecFromPath', () => {
      return buildSpecFromYml(local_component_config_with_environment_secret);
    })
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}`)
      .reply(200, account)
      .persist())
    .stub(SecretUtils, 'getSecrets', () => {
      return [
        {
          key: 'a_required_key',
          value: '12345.123456789',
          scope: '*',
        },
      ];
    })
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world'), '--secrets-env=env', '-a', 'examples', '--ssl=false'])
    .it('Create a local dev with a number secret in an environment secret', ctx => {
      const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true;
      const hello_world_environment = (runCompose.firstCall.args[0].services[hello_api_ref] as any).environment;
      expect(hello_world_environment.a_required_key).to.equal('12345.123456789');
    });

  test
    .timeout(20000)
    .stub(ComponentBuilder, 'buildSpecFromPath', () => {
      return buildSpecFromYml(local_component_config_with_environment_secret);
    })
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}`)
      .reply(200, account)
      .persist())
    .stub(SecretUtils, 'getSecrets', () => {
      return [];
    })
    .stub(Dev.prototype, 'failIfEnvironmentExists', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stub(Dev.prototype, 'downloadSSLCerts', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['dev', getMockComponentFilePath('hello-world'), '-s', 'a_required_key=12345.123456789', '-a', 'examples', '--ssl=false'])
    .it('Create a local dev with a number secret with many digits after decimal point', ctx => {
      const runCompose = Dev.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true;
      const hello_world_environment = (runCompose.firstCall.args[0].services[hello_api_ref] as any).environment;
      expect(hello_world_environment.a_required_key).to.equal('12345.123456789');
    });
});
