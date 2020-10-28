import { expect, test } from '@oclif/test';
import path from 'path';
import sinon, { SinonSpy } from 'sinon';
import Deploy, { DeployCommand } from '../../src/commands/deploy';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import * as DockerCompose from '../../src/common/docker-compose';
import { EnvironmentConfigBuilder } from '../../src/dependency-manager/src';
import { mockArchitectAuth, MOCK_API_HOST } from '../utils/mocks';

// set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
const print = true; // TODO: restore

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
  const local_env_config = {
    "components": {
      "examples/database-seeding:latest": "file:./examples/database-seeding/",
      "examples/echo:latest": "file:./examples/echo/"
    }
  }

  const expected_compose = {
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
      "examples--echo--echo-api--latest--2nxfcm8h": {
        "ports": [
          "50002:8080"
        ],
        "depends_on": [],
        "environment": {},
        "image": "hashicorp/http-echo:latest",
        "command": [
          "-listen=:8080",
          "-text=hello world"
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
    .it('Create a local deploy', ctx => {
      const runCompose = Deploy.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true
      expect(runCompose.firstCall.args[0]).to.deep.equal(expected_compose)
    })

  test
    .timeout(15000)
    .stub(EnvironmentConfigBuilder, 'readFromPath', () => {
      return [JSON.stringify(local_env_config, null, 2), local_env_config];
    })
    .stub(DockerCompose, 'generate', sinon.stub().returns(undefined))
    .stub(Deploy.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .env({
      ARC_LOG_LEVEL: 'debug',
      ARC_aws_secret: 'test'
    })
    .command(['deploy', '-l', './mock-environment.yml'])
    .it('Create a local deploy with environment parameters', ctx => {
      const generate = DockerCompose.generate as sinon.SinonStub;
      expect(generate.calledOnce).to.be.true
      const dependency_manager = generate.firstCall.args[0] as LocalDependencyManager;
      expect(dependency_manager.environment.getParameters()).to.deep.equal({
        LOG_LEVEL: { default: 'debug' },
        aws_secret: { default: 'test' }
      })
      const runCompose = Deploy.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true
    })

  const component_expected_compose = {
    "version": "3",
    "services": {
       "examples--hello-world--api--latest--d00ztoyu": {
          "ports": [
             "50003:3000"
          ],
          "depends_on": [
             "gateway"
          ],
          "environment": {
             "VIRTUAL_HOST": "echo.localhost",
             "VIRTUAL_PORT_echo_localhost": "3000",
             "VIRTUAL_PORT": "3000",
             "VIRTUAL_PROTO": "http"
          },
          "external_links": [
             "gateway:echo.localhost",
             "gateway:echo-dos.localhost",
             "gateway:echo-other.localhost"
          ],
          "image": "heroku/nodejs-hello-world",
          "restart": "always"
       },
       "examples--hello-world--api-dos--latest--b7mzopza": {
          "ports": [
             "50004:3000"
          ],
          "depends_on": [
             "gateway"
          ],
          "environment": {
             "VIRTUAL_HOST": "echo-dos.localhost",
             "VIRTUAL_PORT_echo_dos_localhost": "3000",
             "VIRTUAL_PORT": "3000",
             "VIRTUAL_PROTO": "http"
          },
          "external_links": [
             "gateway:echo.localhost",
             "gateway:echo-dos.localhost",
             "gateway:echo-other.localhost"
          ],
          "image": "heroku/nodejs-hello-world",
          "restart": "always"
       },
       "examples--hello-other-world--api--latest--h6kkprnr": {
          "ports": [
             "50005:3000"
          ],
          "depends_on": [
             "gateway"
          ],
          "environment": {
             "VIRTUAL_HOST": "echo-other.localhost",
             "VIRTUAL_PORT_echo_other_localhost": "3000",
             "VIRTUAL_PORT": "3000",
             "VIRTUAL_PROTO": "http"
          },
          "external_links": [
             "gateway:echo.localhost",
             "gateway:echo-dos.localhost",
             "gateway:echo-other.localhost"
          ],
          "image": "heroku/nodejs-hello-world",
          "restart": "always"
       },
       "gateway": {
          "image": "architectio/nginx-proxy:latest",
          "restart": "always",
          "volumes": [
             "/var/run/docker.sock:/tmp/docker.sock:ro"
          ],
          "depends_on": [],
          "environment": {
             "HTTPS_METHOD": "noredirect",
             "DISABLE_ACCESS_LOGS": "true",
          },
          "logging": {
             "driver": "none"
          }
       }
    },
    "volumes": {}
  };

  const hello_world_component_config = {
    "name": "examples/hello-world",
    "services": {
      "api": {
        "image": "heroku/nodejs-hello-world",
        "interfaces": {
          "main": {
            "port": "3000"
          }
        },
        "name": "api"
      },
      "api-dos": {
        "image": "heroku/nodejs-hello-world",
        "interfaces": {
          "main": {
            "port": "3000"
          }
        },
        "name": "api-dos"
      }
    },
    "interfaces": {
      "echo": {
        "host": "${{ services.api.interfaces.main.host }}",
        "port": "${{ services.api.interfaces.main.port }}",
        "protocol": "${{ services.api.interfaces.main.protocol }}",
        "url": "${{ services.api.interfaces.main.protocol }}://${{ services.api.interfaces.main.host }}:${{ services.api.interfaces.main.port }}"
      },
      "echo-dos": {
        "host": "${{ services.api-dos.interfaces.main.host }}",
        "port": "${{ services.api-dos.interfaces.main.port }}",
        "protocol": "${{ services.api-dos.interfaces.main.protocol }}",
        "url": "${{ services.api-dos.interfaces.main.protocol }}://${{ services.api-dos.interfaces.main.host }}:${{ services.api-dos.interfaces.main.port }}"
      },
      "echo-other": {
        "host": "${{ dependencies['examples/hello-other-world'].interfaces.echo-other.host }}",
        "port": "${{ dependencies['examples/hello-other-world'].interfaces.echo-other.port }}",
        "protocol": "${{ dependencies['examples/hello-other-world'].interfaces.echo-other.protocol }}",
        "url": "${{ dependencies['examples/hello-other-world'].interfaces.echo-other.protocol }}://${{ dependencies['examples/hello-other-world'].interfaces.echo-other.host }}:${{ dependencies['examples/hello-other-world'].interfaces.echo-other.port }}"
      }
    },
    "dependencies": {
      "examples/hello-other-world": "latest"
    },
  };

  const hello_other_world_component_config = {
    "name": "examples/hello-other-world:latest",
    "services": {
      "api": {
        "image": "heroku/nodejs-hello-world",
        "interfaces": {
          "main": {
            "port": "3000"
          }
        },
        "name": "api"
      }
    },
    "interfaces": {
      "echo-other": {
        "host": "${{ services.api.interfaces.main.host }}",
        "port": "${{ services.api.interfaces.main.port }}",
        "protocol": "${{ services.api.interfaces.main.protocol }}",
        "url": "${{ services.api.interfaces.main.protocol }}://${{ services.api.interfaces.main.host }}:${{ services.api.interfaces.main.port }}"
      }
    }
  };

  test
    .timeout(15000)
    .stub(Deploy.prototype, 'runCompose', sinon.stub().returns(undefined))
    .stdout({ print })
    .stderr({ print })
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples/components/hello-world/versions/latest`)
      .reply(200, {config: hello_world_component_config}))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples/components/hello-other-world/versions/latest`)
      .reply(200, {config: hello_other_world_component_config}))
    .command(['deploy', '-l', 'examples/hello-world:latest', '-i', 'echo:echo', '-i', 'echo-dos:echo-dos', '-i', 'echo-other:echo-other'])
    .it('Create a local deploy from a component ref', ctx => {
      const runCompose = Deploy.prototype.runCompose as sinon.SinonStub;
      expect(runCompose.calledOnce).to.be.true;
      const created_compose = runCompose.firstCall.args[0];
      delete created_compose.services.gateway.ports;
      delete created_compose.services.gateway.environment.HTTP_PORT;
      expect(created_compose).to.deep.equal(component_expected_compose);
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


  const env_config_with_interfaces = {
    components: {
      'examples/hello-world': 'latest',
      'examples/hello-other-world': 'latest'
    },
    interfaces: {
      echo: "${{components['examples/hello-world'].interfaces.echo.url}}",
      'echo-dos': "${{components['examples/hello-world'].interfaces.echo-dos.url}}",
      'echo-other': "${{components['examples/hello-other-world'].interfaces.echo-other.url}}"
    },
  };

  const hello_world_component_digest = {
    "id": "37a01809-a2e8-4000-b211-fa39d1d21ffc",
    "tag": "latest",
    "config": {
      "name": "examples/hello-world",
      "services": {
        "api": {
          "interfaces": {
            "main": 3000
          },
        },
        "api-dos": {
          "interfaces": {
            "main": 3000
          },
        }
      },
      "interfaces": {
        "echo": {
          "url": "${{ services.api.interfaces.main.url }}"
        },
        "echo-dos": {
          "url": "${{ services.api-dos.interfaces.main.url }}"
        },
        "echo-other": {
          "url": "${{ dependencies['examples/hello-other-world'].interfaces.echo-other.url }}"
        }
      },
      "dependencies": {
        "examples/hello-other-world": "latest"
      }
    },
    "component": {
      "id": "2638e8a4-0cdf-4581-b59a-2120d3616e03",
      "name": "hello-world",
    }
  };

  const hello_world_edges = [
    {
      "to": "examples/hello-other-world/api:latest",
      "interfaces_map": {
        "echo-other": "main"
      }
    },
    {
      "to": "examples/hello-world/api:latest",
      "interfaces_map": {
        "echo": "main"
      }
    },
    {
      "to": "examples/hello-world/api-dos:latest",
      "interfaces_map": {
        "echo-dos": "main"
      }
    }
  ];

  let deploy_spy: SinonSpy;
  mockArchitectAuth.stub(DeployCommand, 'POLL_INTERVAL', () => { return 0 })
    .do(ctx => {
      deploy_spy = sinon.fake.returns(undefined);
      sinon.replace(DeployCommand.prototype, 'deployRemote', deploy_spy);
    })
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}`)
      .reply(200, account))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/environments/${environment.name}`)
      .reply(200, environment))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples/components/hello-world`)
      .reply(200, hello_world_component_digest))
    .nock(MOCK_API_HOST, api => api
      .get(`/components/2638e8a4-0cdf-4581-b59a-2120d3616e03/versions/latest/graph`)
      .reply(200, { edges: hello_world_edges}))
    .command(['deploy', 'examples/hello-world:latest', '-e', environment.name, '-a', account.name, '-i', 'echo:echo', '-i', 'echo-dos:echo-dos', '-i', 'echo-other:echo-other', '--auto_approve'])
    .it('Environment config contains specified interfaces', ctx => {
      expect(deploy_spy.callCount).eq(1);
      expect(deploy_spy.args[0][0]).to.deep.equal(environment);
      expect(deploy_spy.args[0][1]).to.deep.equal(env_config_with_interfaces);
      expect(deploy_spy.args[0][2]).to.be.true;
      sinon.restore();
    });
});
