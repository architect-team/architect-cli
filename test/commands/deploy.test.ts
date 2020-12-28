import { expect, test } from '@oclif/test';
import path from 'path';
import sinon from 'sinon';
import Deploy, { DeployCommand } from '../../src/commands/deploy';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../../src/common/docker-compose';
import PortUtil from '../../src/common/utils/port';
import { ComponentConfigBuilder, EnvironmentConfigBuilder } from '../../src/dependency-manager/src';
import { mockArchitectAuth, MOCK_API_HOST } from '../utils/mocks';

// set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
const print = true; // TODO: reset

const account = {
  id: 'test-account-id',
  name: 'test-account'
}

const environment = {
  id: 'test-env-id',
  name: 'test-env'
}

const mock_deployment = {
  id: 'test-deployment-id'
}

describe('local deploy environment', function () {

  beforeEach(() => {
    sinon.replace(PortUtil, 'isPortAvailable', async () => true);
    PortUtil.reset();
  });

  afterEach(function () {
    sinon.restore();
  });

  const local_env_config = {
    "components": {
      "examples/database-seeding:latest": "file:./examples/database-seeding/",
      "examples/echo:latest": "file:./examples/hello-world/"
    }
  }

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
    }
  }
  const basic_parameter_values = {
    'examples/hello-world:latest': {
      'a_required_key': 'some_value',
      'another_required_key': 'required_value',
      'one_more_required_param': 'one_more_value'
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
      'world_text': 'some other name'
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

  const environment_expected_compose = {
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
        "depends_on": [],
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
        "depends_on": [],
        "environment": {},
        "image": "heroku/nodejs-hello-world",
      }
    },
    "volumes": {}
  }

  const seeding_component_expected_compose = {
    "version": "3",
    "services": {
      "examples--database-seeding--app--latest--7fdljhug": {
        "ports": [
          "50000:3000"
        ],
        "restart": "always",
        "depends_on": [
          "examples--database-seeding--my-demo-db--latest--uimfmkw0",
          "gateway"
        ],
        "environment": {
          "DATABASE_HOST": "examples--database-seeding--my-demo-db--latest--uimfmkw0",
          "DATABASE_PORT": "5432",
          "DATABASE_USER": "postgres",
          "DATABASE_PASSWORD": "architect",
          "DATABASE_SCHEMA": "test-db",
          "AUTO_DDL": "seed",
          "VIRTUAL_HOST": "app.localhost",
          "VIRTUAL_PORT": "3000",
          "VIRTUAL_PORT_app_localhost": "3000",
          "VIRTUAL_PROTO": "http"
        },
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
        "depends_on": [],
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
        "depends_on": [],
        "environment": {
          "DISABLE_ACCESS_LOGS": "true",
          "HTTPS_METHOD": "noredirect",
          "HTTP_PORT": 80
        },
        "image": "architectio/nginx-proxy:latest",
        "logging": {
          "driver": "none"
        },
        "ports": [
          "80:80"
        ],
        "restart": "always",
        "volumes": [
          "/var/run/docker.sock:/tmp/docker.sock:ro"
        ]
      }
    },
    "volumes": {}
  }

  const basic_component_expected_compose = {
    "version": "3",
    "services": {
      "examples--hello-world--api--latest--d00ztoyu": {
        "ports": [
          "50000:3000",
        ],
        "environment": {},
        "image": "heroku/nodejs-hello-world",
        "depends_on": []
      }
    },
    "volumes": {}
  }

  const component_expected_compose = {
    "version": "3",
    "services": {
      "examples--hello-world--api--latest--d00ztoyu": {
        "ports": [
          "50000:3000",
        ],
        "restart": "always",
        "depends_on": [
          "gateway"
        ],
        "environment": {
          "VIRTUAL_HOST": "test.localhost",
          "VIRTUAL_PORT": "3000",
          "VIRTUAL_PORT_test_localhost": "3000",
          "VIRTUAL_PROTO": "http"
        },
        "external_links": [
          "gateway:test.localhost"
        ],
        "image": "heroku/nodejs-hello-world",
      },
      "gateway": {
        "depends_on": [],
        "environment": {
          "DISABLE_ACCESS_LOGS": "true",
          "HTTPS_METHOD": "noredirect",
          "HTTP_PORT": 80
        },
        "image": "architectio/nginx-proxy:latest",
        "logging": {
          "driver": "none"
        },
        "ports": [
          "80:80"
        ],
        "restart": "always",
        "volumes": [
          "/var/run/docker.sock:/tmp/docker.sock:ro"
        ]
      }
    },
    "volumes": {}
  }

  const component_with_basic_values_expected_compose = {
    "version": "3",
    "services": {
      "examples--hello-world--api--latest--d00ztoyu": {
        "ports": [
          "50000:3000",
        ],
        "restart": "always",
        "depends_on": [
          "gateway"
        ],
        "environment": {
          "VIRTUAL_HOST": "test.localhost",
          "VIRTUAL_PORT": "3000",
          "VIRTUAL_PORT_test_localhost": "3000",
          "VIRTUAL_PROTO": "http",
          "a_required_key": "some_value",
          "another_required_key": "required_value",
          'one_more_required_param': 'one_more_value'
        },
        "external_links": [
          "gateway:test.localhost"
        ],
        "image": "heroku/nodejs-hello-world",
      },
      "gateway": {
        "depends_on": [],
        "environment": {
          "DISABLE_ACCESS_LOGS": "true",
          "HTTPS_METHOD": "noredirect",
          "HTTP_PORT": 80
        },
        "image": "architectio/nginx-proxy:latest",
        "logging": {
          "driver": "none"
        },
        "ports": [
          "80:80"
        ],
        "restart": "always",
        "volumes": [
          "/var/run/docker.sock:/tmp/docker.sock:ro"
        ]
      }
    },
    "volumes": {}
  }

  const component_with_dependency_expected_compose = {
    "version": "3",
    "services": {
      "examples--hello-world--api--latest--d00ztoyu": {
        "ports": [
          "50000:3000",
        ],
        "restart": "always",
        "depends_on": [
          "gateway"
        ],
        "environment": {
          "VIRTUAL_HOST": "test.localhost",
          "VIRTUAL_PORT": "3000",
          "VIRTUAL_PORT_test_localhost": "3000",
          "VIRTUAL_PROTO": "http",
          "a_required_key": "some_value",
          "another_required_key": "required_value",
          'one_more_required_param': 'one_more_value'
        },
        "external_links": [
          "gateway:test.localhost"
        ],
        "image": "heroku/nodejs-hello-world",
      },
      "examples--react-app--app--latest--aklmrtvo": {
        "depends_on": [],
        "environment": {
          "PORT": "8080",
          "WORLD_TEXT": "some other name"
        },
        "external_links": [
          "gateway:test.localhost"
        ],
        "ports": [
          "50001:8080"
        ]
      },
      "gateway": {
        "depends_on": [],
        "environment": {
          "DISABLE_ACCESS_LOGS": "true",
          "HTTPS_METHOD": "noredirect",
          "HTTP_PORT": 80
        },
        "image": "architectio/nginx-proxy:latest",
        "logging": {
          "driver": "none"
        },
        "ports": [
          "80:80"
        ],
        "restart": "always",
        "volumes": [
          "/var/run/docker.sock:/tmp/docker.sock:ro"
        ]
      }
    },
    "volumes": {}
  }

  test
    .timeout(15000)
    .stub(EnvironmentConfigBuilder, 'readFromPath', () => {
      return [JSON.stringify(local_env_config, null, 2), local_env_config];
    })
    .stub(Deploy.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['deploy', '-l', './mock-environment.yml'])
    .it('Create a local deploy with an environment config', ctx => {
      const runCompose = Deploy.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true
      expect(runCompose.firstCall.args[0]).to.deep.equal(environment_expected_compose)
    })

  test
    .timeout(15000)
    .stub(ComponentConfigBuilder, 'buildFromPath', () => {
      return ComponentConfigBuilder.buildFromJSON(local_component_config);
    })
    .stub(Deploy.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['deploy', '-l', './examples/hello-world/architect.yml'])
    .it('Create a basic local deploy with a component config', ctx => {
      const runCompose = Deploy.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true
      expect(runCompose.firstCall.args[0]).to.deep.equal(basic_component_expected_compose)
    })

  test
    .timeout(15000)
    .stub(ComponentConfigBuilder, 'buildFromPath', () => {
      return ComponentConfigBuilder.buildFromJSON(local_component_config);
    })
    .stub(Deploy.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['deploy', '-l', './examples/hello-world/architect.yml', '-i', 'test:hello'])
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
    .stub(EnvironmentConfigBuilder, 'readFromPath', () => {
      return [JSON.stringify(local_env_config, null, 2), local_env_config];
    })
    .stub(DockerComposeUtils, 'generate', sinon.stub().returns(undefined))
    .stub(Deploy.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .env({
      ARC_LOG_LEVEL: 'debug',
      ARC_aws_secret: 'test'
    })
    .command(['deploy', '-l', './mock-environment.yml'])
    .it('Create a local deploy with environment parameters', ctx => {
      const generate = DockerComposeUtils.generate as sinon.SinonStub;
      expect(generate.calledOnce).to.be.true
      const dependency_manager = generate.firstCall.args[0] as LocalDependencyManager;
      expect(dependency_manager.environment.getParameters()).to.deep.equal({
        LOG_LEVEL: { default: 'debug' },
        aws_secret: { default: 'test' }
      })
      const runCompose = Deploy.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true
    })

  test
    .timeout(15000)
    .stub(ComponentConfigBuilder, 'buildFromPath', () => {
      return ComponentConfigBuilder.buildFromJSON(local_component_config_with_parameters);
    })
    .stub(Deploy.prototype, 'readValuesFile', () => {
      return basic_parameter_values;
    })
    .stub(Deploy.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['deploy', '-l', './examples/hello-world/architect.yml', '-i', 'test:hello', '-v', './examples/hello-world/values.yml'])
    .it('Create a local deploy with a basic component and a basic values file', ctx => {
      const runCompose = Deploy.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true
      expect(runCompose.firstCall.args[0]).to.deep.equal(component_with_basic_values_expected_compose)
    })

  test
    .timeout(15000)
    .stub(ComponentConfigBuilder, 'buildFromPath', () => {
      return ComponentConfigBuilder.buildFromJSON(local_component_config_with_parameters);
    })
    .stub(Deploy.prototype, 'readValuesFile', () => {
      return wildcard_parameter_values;
    })
    .stub(Deploy.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['deploy', '-l', './examples/hello-world/architect.yml', '-i', 'test:hello', '-v', './examples/hello-world/values.yml'])
    .it('Create a local deploy with a basic component and a wildcard values file', ctx => {
      const runCompose = Deploy.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true
      expect(runCompose.firstCall.args[0]).to.deep.equal(component_with_basic_values_expected_compose)
    })

  test
    .timeout(15000)
    .stub(ComponentConfigBuilder, 'buildFromPath', () => {
      return ComponentConfigBuilder.buildFromJSON(local_component_config_with_parameters);
    })
    .stub(Deploy.prototype, 'readValuesFile', () => {
      return stacked_parameter_values;
    })
    .stub(Deploy.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .command(['deploy', '-l', './examples/hello-world/architect.yml', '-i', 'test:hello', '-v', './examples/hello-world/values.yml'])
    .it('Create a local deploy with a basic component and a stacked values file', ctx => {
      const runCompose = Deploy.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true
      expect(runCompose.firstCall.args[0]).to.deep.equal(component_with_basic_values_expected_compose)
    })

  test
    .timeout(15000)
    .stub(ComponentConfigBuilder, 'buildFromPath', () => {
      return ComponentConfigBuilder.buildFromJSON(local_component_config_with_dependency);
    })
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
      expect(runCompose.calledOnce).to.be.true
      expect(runCompose.firstCall.args[0]).to.deep.equal(component_with_dependency_expected_compose)
    })
});

describe('remote deploy environment', function () {
  const env_config = {
    "components": {
      "examples/database-seeding": "latest",
      "examples/echo": "latest"
    }
  };

  const remoteDeploy = mockArchitectAuth
    .stub(EnvironmentConfigBuilder, 'readFromPath', () => {
      return [JSON.stringify(env_config, null, 2), env_config];
    })
    .stub(DeployCommand, 'POLL_INTERVAL', () => { return 0 })
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}`)
      .reply(200, account))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/environments/${environment.name}`)
      .reply(200, environment))
    .nock(MOCK_API_HOST, api => api
      .post(`/environments/${environment.id}/deploy`)
      .reply(200, mock_deployment))
    .nock(MOCK_API_HOST, api => api
      .post(`/deploy/${mock_deployment.id}?lock=true&refresh=true`)
      .reply(200, {}))
    .nock(MOCK_API_HOST, api => api
      .get(`/deploy/${mock_deployment.id}`)
      .reply(200, { ...mock_deployment, applied_at: new Date() }))
    .stdout({ print })
    .stderr({ print })

  remoteDeploy
    .command(['deploy', '-e', environment.name, '-a', account.name, '--auto_approve', './mock-environment.yml'])
    .it('Creates a remote deployment when env exists with env and account flags', ctx => {
      expect(ctx.stdout).to.contain('Deployed')
    })

  remoteDeploy
    .env({ 'ARCHITECT_ACCOUNT': account.name })
    .command(['deploy', '-e', environment.name, '--auto_approve', './mock-environment.yml'])
    .it('Creates a deployment when env exists with only env flag', ctx => {
      expect(ctx.stdout).to.contain('Deployed')
    })
});
