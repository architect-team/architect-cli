import { expect, test } from '@oclif/test';
import path from 'path';
import sinon from 'sinon';
import Deploy, { DeployCommand } from '../../src/commands/deploy';
import DockerComposeTemplate from '../../src/common/docker-compose/template';
import * as Docker from '../../src/common/utils/docker';
import PortUtil from '../../src/common/utils/port';
import { ComponentConfigBuilder } from '../../src/dependency-manager/src';
import { mockArchitectAuth, MOCK_API_HOST } from '../utils/mocks';

// set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
const print = false;

const account = {
  id: 'test-account-id',
  name: 'test-account'
}

const environment = {
  id: 'test-env-id',
  name: 'test-env'
}

const mock_pipeline = {
  id: 'test-pipeline-id'
}

describe('local deploy environment', function () {

  beforeEach(() => {
    sinon.replace(PortUtil, 'isPortAvailable', async () => true);
    PortUtil.reset();
  });

  afterEach(function () {
    sinon.restore();
  });

  const local_component_config = {
    "name": "examples/hello-world",

    "services": {
      "api": {
        "image": "heroku/nodejs-hello-world",
        "interfaces": {
          "main": "3000"
        }
      }
    },

    "interfaces": {
      "hello": {
        "url": "${{ services.api.interfaces.main.url }}"
      }
    }
  }

  const local_component_config_with_parameters = {
    "name": "examples/hello-world",

    "services": {
      "api": {
        "image": "heroku/nodejs-hello-world",
        "interfaces": {
          "main": "3000"
        },
        "environment": {
          "a_required_key": "${{ parameters.a_required_key }}",
          "another_required_key": "${{ parameters.another_required_key }}",
          "one_more_required_param": "${{ parameters.one_more_required_param }}",
          "compose_escaped_variable": "${{ parameters.compose_escaped_variable }}"
        }
      }
    },

    "interfaces": {
      "hello": {
        "url": "${{ services.api.interfaces.main.url }}"
      }
    },

    "parameters": {
      'a_required_key': {
        'required': 'true'
      },
      'another_required_key': {
        'required': 'true'
      },
      'one_more_required_param': {
        'required': 'true'
      },
      'compose_escaped_variable': {
        'required': 'false'
      }
    }
  }
  const basic_parameter_values = {
    'examples/hello-world:latest': {
      'a_required_key': 'some_value',
      'another_required_key': 'required_value',
      'one_more_required_param': 'one_more_value',
      'compose_escaped_variable': 'variable_split_$_with_dollar$signs',
    },
  }
  const wildcard_parameter_values = {
    'examples/hello-world:*': {
      'a_required_key': 'some_value',
    },
    'examples/hello-world:la*': {
      'one_more_required_param': 'one_more_value'
    },
    '*': {
      'another_required_key': 'required_value'
    }
  }
  const stacked_parameter_values = {
    'examples/hello-world:*': {
      'a_required_key': 'some_value',
      'another_required_key': 'required_value',
      'one_more_required_param': 'one_more_value'
    },
    '*': {
      'a_required_key': 'a_value_which_will_be_overwritten',
      'another_required_key': 'another_value_which_will_be_overwritten'
    }
  }

  const local_component_config_with_dependency = {
    "name": "examples/hello-world",

    "services": {
      "api": {
        "image": "heroku/nodejs-hello-world",
        "interfaces": {
          "main": "3000"
        },
        "environment": {
          "a_required_key": "${{ parameters.a_required_key }}",
          "another_required_key": "${{ parameters.another_required_key }}",
          "one_more_required_param": "${{ parameters.one_more_required_param }}"
        }
      }
    },

    "interfaces": {
      "hello": {
        "url": "${{ services.api.interfaces.main.url }}"
      }
    },

    "parameters": {
      'a_required_key': {
        'required': 'true'
      },
      'another_required_key': {
        'required': 'true'
      },
      'one_more_required_param': {
        'required': 'true'
      }
    },

    "dependencies": {
      "examples/react-app": "latest"
    }
  }
  const local_component_config_dependency = {
    'config': {
      'name': 'examples/react-app',
      'interfaces': {
        'app': '\${{ services.app.interfaces.main.url }}'
      },
      'parameters': {
        'world_text': {
          'default': 'world'
        }
      },
      'services': {
        'app': {
          'build': {
            'context': './frontend'
          },
          'interfaces': {
            'main': '8080'
          },
          'environment': {
            'PORT': '\${{ services.app.interfaces.main.port }}',
            'WORLD_TEXT': '\${{ parameters.world_text }}'
          }
        }
      }
    },
    'component': {
      'name': 'examples/react-app',
    },
    'tag': 'latest'
  }
  const component_and_dependency_parameter_values = {
    'examples/hello-world:*': {
      'a_required_key': 'some_value',
      'another_required_key': 'required_value',
      'one_more_required_param': 'one_more_value'
    },
    '*': {
      'a_required_key': 'a_value_which_will_be_overwritten',
      'another_required_key': 'another_value_which_will_be_overwritten',
      'world_text': 'some other name',
      'unused_parameter': 'value_not_used_by_any_component'
    }
  }

  const local_database_seeding_component_config = {
    "name": "examples/database-seeding",

    "parameters": {
      "AUTO_DDL": {
        "default": "none"
      },
      "DB_USER": {
        "default": "postgres"
      },
      "DB_PASS": {
        "default": "architect"
      },
      "DB_NAME": {
        "default": "seeding_demo"
      }
    },

    "services": {
      "app": {
        "build": {
          "context": "./",
          "dockerfile": "Dockerfile"
        },
        "interfaces": {
          "main": "3000"
        },
        "environment": {
          "DATABASE_HOST": "${{ services.my-demo-db.interfaces.postgres.host }}",
          "DATABASE_PORT": "${{ services.my-demo-db.interfaces.postgres.port }}",
          "DATABASE_USER": "${{ services.my-demo-db.environment.POSTGRES_USER }}",
          "DATABASE_PASSWORD": "${{ services.my-demo-db.environment.POSTGRES_PASSWORD }}",
          "DATABASE_SCHEMA": "${{ services.my-demo-db.environment.POSTGRES_DB }}",
          "AUTO_DDL": "${{ parameters.AUTO_DDL }}"
        }
      },

      "my-demo-db": {
        "image": "postgres:11",
        "interfaces": {
          "postgres": "5432"
        },
        "environment": {
          "POSTGRES_DB": "${{ parameters.DB_NAME }}",
          "POSTGRES_USER": "${{ parameters.DB_USER }}",
          "POSTGRES_PASSWORD": "${{ parameters.DB_PASS }}"
        }
      }
    },

    "interfaces": {
      "main": {
        "url": "${{ services.app.interfaces.main.url }}"
      }
    }
  };

  const environment_expected_compose: DockerComposeTemplate = {
    "version": "3",
    "services": {
      "examples--database-seeding--app--latest--7fdljhug": {
        "ports": [
          "50000:3000"
        ],
        "depends_on": [
          "examples--database-seeding--my-demo-db--latest--uimfmkw0"
        ],
        "environment": {
          "DATABASE_HOST": "examples--database-seeding--my-demo-db--latest--uimfmkw0",
          "DATABASE_PORT": "5432",
          "DATABASE_USER": "postgres",
          "DATABASE_PASSWORD": "architect",
          "DATABASE_SCHEMA": "seeding_demo",
          "AUTO_DDL": "none"
        },
        "build": {
          "context": path.resolve('./examples/database-seeding'),
          "dockerfile": "Dockerfile"
        }
      },
      "examples--database-seeding--my-demo-db--latest--uimfmkw0": {
        "ports": [
          "50001:5432"
        ],
        "environment": {
          "POSTGRES_DB": "seeding_demo",
          "POSTGRES_USER": "postgres",
          "POSTGRES_PASSWORD": "architect"
        },
        "image": "postgres:11"
      },
      "examples--echo--api--latest--cpe6ciyk": {
        "ports": [
          "50002:3000",
        ],
        "environment": {},
        "image": "heroku/nodejs-hello-world",
      }
    },
    "volumes": {}
  }
  if (process.platform === 'linux') {
    environment_expected_compose.services['examples--database-seeding--app--latest--7fdljhug'].extra_hosts = [
      "host.docker.internal:host-gateway"
    ];
    environment_expected_compose.services['examples--database-seeding--my-demo-db--latest--uimfmkw0'].extra_hosts = [
      "host.docker.internal:host-gateway"
    ];
    environment_expected_compose.services['examples--echo--api--latest--cpe6ciyk'].extra_hosts = [
      "host.docker.internal:host-gateway"
    ];
  }

  const seeding_component_expected_compose: DockerComposeTemplate = {
    "version": "3",
    "services": {
      "examples--database-seeding--app--latest--7fdljhug": {
        "ports": [
          "50000:3000"
        ],
        "restart": "always",
        "depends_on": [
          "examples--database-seeding--my-demo-db--latest--uimfmkw0"
        ],
        "environment": {
          "DATABASE_HOST": "examples--database-seeding--my-demo-db--latest--uimfmkw0",
          "DATABASE_PORT": "5432",
          "DATABASE_USER": "postgres",
          "DATABASE_PASSWORD": "architect",
          "DATABASE_SCHEMA": "test-db",
          "AUTO_DDL": "seed"
        },
        "labels": [
          "traefik.enable=true",
          "traefik.http.routers.app.rule=Host(`app.localhost`)",
          "traefik.http.routers.app.service=app-service",
          "traefik.http.services.app-service.loadbalancer.server.port=3000",
          "traefik.http.services.app-service.loadbalancer.server.scheme=http"
        ],
        "build": {
          "context": path.resolve('./examples/database-seeding'),
          "dockerfile": "Dockerfile"
        },
        "external_links": [
          "gateway:app.localhost"
        ]
      },
      "examples--database-seeding--my-demo-db--latest--uimfmkw0": {
        "ports": [
          "50001:5432"
        ],
        "environment": {
          "POSTGRES_DB": "test-db",
          "POSTGRES_USER": "postgres",
          "POSTGRES_PASSWORD": "architect"
        },
        "image": "postgres:11",
        "external_links": [
          "gateway:app.localhost"
        ]
      },
      "gateway": {
        "image": "traefik:v2.4",
        "command": [
          "--api.insecure=true",
          "--providers.docker",
          "--providers.docker.exposedByDefault=false"
        ],
        "ports": [
          "80:80",
          "8080:8080"
        ],
        "depends_on": [
          "examples--database-seeding--app--latest--7fdljhug",
        ],
        "restart": "always",
        "volumes": [
          "/var/run/docker.sock:/var/run/docker.sock"
        ]
      }
    },
    "volumes": {}
  }
  if (process.platform === 'linux') {
    seeding_component_expected_compose.services['examples--database-seeding--app--latest--7fdljhug'].extra_hosts = [
      "host.docker.internal:host-gateway"
    ];
    seeding_component_expected_compose.services['examples--database-seeding--my-demo-db--latest--uimfmkw0'].extra_hosts = [
      "host.docker.internal:host-gateway"
    ];
  }

  const component_expected_compose: DockerComposeTemplate = {
    "version": "3",
    "services": {
      "examples--hello-world--api--latest--d00ztoyu": {
        "ports": [
          "50000:3000",
        ],
        "restart": "always",
        "environment": {},
        "labels": [
          "traefik.enable=true",
          "traefik.http.routers.hello.rule=Host(`hello.localhost`)",
          "traefik.http.routers.hello.service=hello-service",
          "traefik.http.services.hello-service.loadbalancer.server.port=3000",
          "traefik.http.services.hello-service.loadbalancer.server.scheme=http"
        ],
        "external_links": [
          "gateway:hello.localhost"
        ],
        "image": "heroku/nodejs-hello-world",
      },
      "gateway": {
        "image": "traefik:v2.4",
        "command": [
          "--api.insecure=true",
          "--providers.docker",
          "--providers.docker.exposedByDefault=false"
        ],
        "ports": [
          "80:80",
          "8080:8080"
        ],
        "depends_on": [
          "examples--hello-world--api--latest--d00ztoyu",
        ],
        "restart": "always",
        "volumes": [
          "/var/run/docker.sock:/var/run/docker.sock"
        ]
      }
    },
    "volumes": {}
  }
  if (process.platform === 'linux') {
    component_expected_compose.services['examples--hello-world--api--latest--d00ztoyu'].extra_hosts = [
      "host.docker.internal:host-gateway"
    ];
  }

  test
    .timeout(15000)
    .stub(ComponentConfigBuilder, 'buildFromPath', () => {
      return ComponentConfigBuilder.buildFromJSON(local_component_config);
    })
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .stub(Deploy.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['deploy', '-l', './examples/hello-world/architect.yml', '-i', 'hello'])
    .it('Create a local deploy with a component and an interface', ctx => {
      const runCompose = Deploy.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true
      expect(runCompose.firstCall.args[0]).to.deep.equal(component_expected_compose)
    })

  test
    .timeout(15000)
    .stub(ComponentConfigBuilder, 'buildFromPath', () => {
      return ComponentConfigBuilder.buildFromJSON(local_database_seeding_component_config);
    })
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .stub(Deploy.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['deploy', '-l', './examples/database-seeding/architect.yml', '-p', 'AUTO_DDL=seed', '-p', 'DB_NAME=test-db', '-i', 'app:main'])
    .it('Create a local deploy with a component, parameters, and an interface', ctx => {
      const runCompose = Deploy.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true
      expect(runCompose.firstCall.args[0]).to.deep.equal(seeding_component_expected_compose)
    })

  test
    .timeout(15000)
    .stub(ComponentConfigBuilder, 'buildFromPath', () => {
      return ComponentConfigBuilder.buildFromJSON(local_component_config_with_parameters);
    })
    .stub(Deploy.prototype, 'readValuesFile', () => {
      return basic_parameter_values;
    })
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .stub(Deploy.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['deploy', '-l', './examples/hello-world/architect.yml', '-i', 'test:hello', '-v', './examples/hello-world/values.yml'])
    .it('Create a local deploy with a basic component and a basic values file', ctx => {
      const runCompose = Deploy.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true;
      const hello_world_service = Object.values(runCompose.firstCall.args[0].services)[0] as any;
      expect(hello_world_service.external_links).to.contain('gateway:test.localhost');
      expect(hello_world_service.environment.a_required_key).to.equal('some_value');
      expect(hello_world_service.environment.another_required_key).to.equal('required_value');
      expect(hello_world_service.environment.one_more_required_param).to.equal('one_more_value');
    })

  test
    .timeout(15000)
    .stub(ComponentConfigBuilder, 'buildFromPath', () => {
      return ComponentConfigBuilder.buildFromJSON(local_component_config_with_parameters);
    })
    .stub(Deploy.prototype, 'readValuesFile', () => {
      return wildcard_parameter_values;
    })
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .stub(Deploy.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['deploy', '-l', './examples/hello-world/architect.yml', '-i', 'test:hello', '-v', './examples/hello-world/values.yml'])
    .it('Create a local deploy with a basic component and a wildcard values file', ctx => {
      const runCompose = Deploy.prototype.runCompose as sinon.SinonStub;
      const hello_world_environment = (Object.values(runCompose.firstCall.args[0].services)[0] as any).environment;
      expect(hello_world_environment.a_required_key).to.equal('some_value');
      expect(hello_world_environment.another_required_key).to.equal('required_value');
      expect(hello_world_environment.one_more_required_param).to.equal('one_more_value');
    })

  test
    .timeout(15000)
    .stub(ComponentConfigBuilder, 'buildFromPath', () => {
      return ComponentConfigBuilder.buildFromJSON(local_component_config_with_parameters);
    })
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .stub(Deploy.prototype, 'readValuesFile', () => {
      return stacked_parameter_values;
    })
    .stub(Deploy.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['deploy', '-l', './examples/hello-world/architect.yml', '-i', 'test:hello', '-v', './examples/hello-world/values.yml'])
    .it('Create a local deploy with a basic component and a stacked values file', ctx => {
      const runCompose = Deploy.prototype.runCompose as sinon.SinonStub;
      const hello_world_environment = (Object.values(runCompose.firstCall.args[0].services)[0] as any).environment;
      expect(hello_world_environment.a_required_key).to.equal('some_value');
      expect(hello_world_environment.another_required_key).to.equal('required_value');
      expect(hello_world_environment.one_more_required_param).to.equal('one_more_value');
    })

  test
    .timeout(15000)
    .stub(ComponentConfigBuilder, 'buildFromPath', () => {
      return ComponentConfigBuilder.buildFromJSON(local_component_config_with_dependency);
    })
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .stub(Deploy.prototype, 'readValuesFile', () => {
      return component_and_dependency_parameter_values;
    })
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples/components/react-app/versions/latest`)
      .reply(200, local_component_config_dependency))
    .stub(Deploy.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['deploy', '-l', './examples/hello-world/architect.yml', '-i', 'test:hello', '-v', './examples/hello-world/values.yml'])
    .it('Create a local deploy with a basic component, a dependency, and a values file', ctx => {
      const runCompose = Deploy.prototype.runCompose as sinon.SinonStub;
      const hello_world_environment = (Object.values(runCompose.firstCall.args[0].services)[0] as any).environment;
      const react_app_environment = (Object.values(runCompose.firstCall.args[0].services)[1] as any).environment;
      expect(hello_world_environment.a_required_key).to.equal('some_value');
      expect(hello_world_environment.another_required_key).to.equal('required_value');
      expect(hello_world_environment.one_more_required_param).to.equal('one_more_value');
      expect(react_app_environment.WORLD_TEXT).to.equal('some other name');
    })

  test
    .timeout(15000)
    .stub(ComponentConfigBuilder, 'buildFromPath', () => {
      return ComponentConfigBuilder.buildFromJSON(local_component_config_with_parameters);
    })
    .stub(Deploy.prototype, 'readValuesFile', () => {
      return basic_parameter_values;
    })
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .stub(Deploy.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['deploy', '-l', './examples/hello-world/architect.yml', '-v', './examples/hello-world/values.yml'])
    .it('Dollar signs are escaped for environment variables in local compose deployments', ctx => {
      const runCompose = Deploy.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true;
      const hello_world_service = Object.values(runCompose.firstCall.args[0].services)[0] as any;
      expect(hello_world_service.environment.compose_escaped_variable).to.equal('variable_split_$$_with_dollar$$signs');
    })
});

describe('remote deploy environment', function () {
  const remoteDeploy = mockArchitectAuth
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .stub(DeployCommand, 'POLL_INTERVAL', () => { return 0 })
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}`)
      .reply(200, account))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/environments/${environment.name}`)
      .reply(200, environment))
    .nock(MOCK_API_HOST, api => api
      .post(`/environments/${environment.id}/deploy`)
      .reply(200, mock_pipeline))
    .nock(MOCK_API_HOST, api => api
      .post(`/pipelines/${mock_pipeline.id}/approve`)
      .reply(200, {}))
    .nock(MOCK_API_HOST, api => api
      .get(`/pipelines/${mock_pipeline.id}`)
      .reply(200, { ...mock_pipeline, applied_at: new Date() }))
    .stdout({ print })
    .stderr({ print })

  remoteDeploy
    .command(['deploy', '-e', environment.name, '-a', account.name, '--auto_approve', 'examples/echo:latest'])
    .it('Creates a remote deployment when env exists with env and account flags', ctx => {
      expect(ctx.stdout).to.contain('Deployed')
    })
});
