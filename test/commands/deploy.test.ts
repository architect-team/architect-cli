import { expect } from '@oclif/test';
import fs from 'fs-extra';
import moxios from 'moxios';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import AppConfig from '../../src/app-config/config';
import CredentialManager from '../../src/app-config/credentials';
import AppService from '../../src/app-config/service';
import Deploy from '../../src/commands/deploy';
import Link from '../../src/commands/link';
import DockerComposeTemplate, { DockerService } from '../../src/common/docker-compose/template';
import { AccountUtils } from '../../src/common/utils/account';
import PortUtil from '../../src/common/utils/port';
import { EnvironmentConfigBuilder } from '../../src/dependency-manager/src';
import ARCHITECTPATHS from '../../src/paths';

const account = {
  id: 'test-account-id',
  name: 'test-account'
}

const environment = {
  id: 'test-env-id',
  name: 'test-env'
}

describe('deploy', function () {
  let tmp_dir = os.tmpdir();

  const local_env_config_path = path.resolve('./test/environment.local.json');
  const env_config_path = path.resolve('./test/environment.json');

  beforeEach(() => {
    // Stub the logger
    sinon.replace(Deploy.prototype, 'log', sinon.stub());
    moxios.install();

    moxios.wait(function () {
      let request = moxios.requests.mostRecent()
      if (request) {
        request.respondWith({
          status: 404,
        })
      }
    })

    sinon.replace(PortUtil, 'isPortAvailable', async () => true);
    PortUtil.reset();

    const credential_spy = sinon.fake.returns('token');
    sinon.replace(CredentialManager.prototype, 'get', credential_spy);

    // Stub the log_level
    const config = new AppConfig('', {
      log_level: 'debug',
    });
    const tmp_config_file = path.join(tmp_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);
    const app_config_stub = sinon.stub().resolves(new AppService(tmp_dir, '0.0.1'));
    sinon.replace(AppService, 'create', app_config_stub);


    const local_env_config = {
      "components": {
        "examples/database-seeding:latest": "file:../examples/database-seeding/",
        "examples/echo:latest": "file:../examples/echo/"
      }
    }

    const env_config = {
      "components": {
        "examples/database-seeding": "latest",
        "examples/echo": "latest"
      }
    };

    sinon.replace(EnvironmentConfigBuilder, 'readFromPath', (config_path: string) => {
      if (config_path === local_env_config_path) {
        return [JSON.stringify(local_env_config, null, 2), local_env_config];
      } else if (config_path === env_config_path) {
        return [JSON.stringify(env_config, null, 2), env_config];
      } else {
        throw new Error('No test env config for: ' + config_path)
      }
    });
  });

  afterEach(() => {
    moxios.uninstall();
    sinon.restore();
  });

  it('generates compose locally', async () => {
    const compose_spy = sinon.fake.resolves(null);
    sinon.replace(Deploy.prototype, 'runCompose', compose_spy);

    // Link the addition service
    const additionServicePath = path.join(__dirname, '../../examples/hello-world');
    await Link.run([additionServicePath]);

    await Deploy.run(['-l', local_env_config_path]);

    const expected_compose = fs.readJSONSync(path.join(__dirname, '../mocks/local-deploy-compose.json')) as DockerComposeTemplate;
    expect(compose_spy.calledOnce).to.equal(true);

    expect(compose_spy.firstCall.args[0].version).to.equal(expected_compose.version);
    for (const svc_key of Object.keys(compose_spy.firstCall.args[0].services)) {
      expect(Object.keys(expected_compose.services)).to.include(svc_key);

      const input = compose_spy.firstCall.args[0].services[svc_key] as DockerService;
      const expected = expected_compose.services[svc_key];

      // Overwrite expected paths with full directories
      if (expected.build?.context) {
        expected.build.context = path.join(__dirname, '../../', expected.build.context).replace(/\/$/gi, '').replace(/\\$/gi, '').toLowerCase();
      }

      if (input.build?.context) {
        input.build.context = input.build.context.replace(/\/$/gi, '').replace(/\\$/gi, '').toLowerCase();
      }

      if (expected.volumes) {
        expected.volumes = expected.volumes.map(volume => {
          const [host, target] = volume.split(':');
          return `${path.join(__dirname, '../../', host)}:${target}`;
        });
      }

      expect(expected.ports).to.have.members(input.ports);
      expect(expected.image).to.equal(input.image);
      expect(expected.depends_on).to.have.members(input.depends_on);
      expect(expected.build).to.deep.eq(input.build);
      expect((expected.command || []).length).to.equal((input.command || []).length);
      if (expected.command && input.command) {
        for (const index of expected.command.keys()) {
          expect(expected.command[index]).to.equal(input.command[index]);
        }
      }
      expect(input.environment).not.to.be.undefined;

      // Test env variables
      expect(Object.keys(input.environment || {})).has.members(Object.keys(expected.environment || {}));
      for (const [key, value] of Object.entries(input.environment || {})) {
        expect(value).to.equal(expected.environment![key]);
      }
    }
  });

  it('Creates a remote deployment when env exists with env and account flags', async () => {
    moxios.stubRequest(`/accounts/${account.name}`, {
      status: 200,
      response: {
        id: account.id
      },
    });

    moxios.stubRequest(`/accounts/${account.id}/environments/${environment.name}`, {
      status: 200,
      response: {
        id: environment.id
      },
    });

    moxios.stubRequest(`/environments/${environment.id}/deploy`, {
      status: 200,
      response: {
        id: 'test-deployment-id'
      }
    });

    moxios.stubRequest(/\/deploy\/test-deployment-id.*/, {
      status: 200,
    });

    const poll_spy = sinon.fake.returns({});
    sinon.replace(Deploy.prototype, 'poll', poll_spy);

    await Deploy.run([env_config_path, '-e', environment.name, '-a', account.name, '--auto_approve']);
    expect(poll_spy.calledOnce).true;
  });

  it('Creates a deployment when env exists with only env flag', async () => {
    moxios.stubRequest(`/accounts/${account.id}/environments/${environment.name}`, {
      status: 200,
      response: {
        id: environment.id
      },
    });

    moxios.stubRequest(`/environments/${environment.id}/deploy`, {
      status: 200,
      response: {
        id: 'test-deployment-id'
      }
    });

    moxios.stubRequest(/\/deploy\/test-deployment-id.*/, {
      status: 200,
    });

    sinon.replace(AccountUtils, 'getAccount', async () => account)

    const poll_spy = sinon.fake.returns({});
    sinon.replace(Deploy.prototype, 'poll', poll_spy);

    await Deploy.run([env_config_path, '-e', environment.name, '--auto_approve']);
    expect(poll_spy.calledOnce).true;
  });
});
