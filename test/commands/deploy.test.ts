import { expect, test } from '@oclif/test';
import path from 'path';
import sinon from 'sinon';
import Deploy, { DeployCommand } from '../../src/commands/deploy';
import { EnvironmentConfigBuilder } from '../../src/dependency-manager/src';
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

const mock_deployment = {
  id: 'test-deployment-id'
}

describe('local deploy', function () {
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
    .timeout(10000)
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
});

describe('remote deploy', function () {
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
