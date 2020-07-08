import { expect } from '@oclif/test';
import fs from 'fs-extra';
import inquirer from 'inquirer';
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
import PortUtil from '../../src/common/utils/port';
import ARCHITECTPATHS from '../../src/paths';

describe('deploy', function () {
  let tmp_dir = os.tmpdir();
  const calculator_env_config_path = path.join(__dirname, '../mocks/calculator-environment-linked-service.json');

  beforeEach(() => {
    // Stub the logger
    sinon.replace(Deploy.prototype, 'log', sinon.stub());
    moxios.install();

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
  });

  afterEach(() => {
    moxios.uninstall();
    sinon.restore();
  });

  it('generates compose locally', async () => {
    const compose_spy = sinon.fake.resolves(null);
    sinon.replace(Deploy.prototype, 'runCompose', compose_spy);

    // Link the addition service
    const additionServicePath = path.join(__dirname, '../calculator/addition-service/rest');
    await Link.run([additionServicePath]);

    await Deploy.run(['-l', calculator_env_config_path]);

    const expected_compose = fs.readJSONSync(path.join(__dirname, '../mocks/calculator-compose.json')) as DockerComposeTemplate;
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

  it('Creates a remote deployment when env exists with env and platform flags', async () => {
    moxios.stubRequest(`/accounts/test-account`, {
      status: 200,
      response: {
        id: 'test-account-id'
      },
    });

    moxios.stubRequest(`/accounts/test-account-id/environments/test-env`, {
      status: 200,
      response: {
        id: 'test-env-id'
      },
    });

    moxios.stubRequest(`/environments/test-env-id/deploy`, {
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

    const validation_spy = sinon.fake.returns(true);
    sinon.replace(Deploy.prototype, 'validateNamespacedInput', validation_spy);

    await Deploy.run([calculator_env_config_path, '-e', 'test-account/test-env', '-p', 'test-account/test-platform', '--auto_approve']);
    expect(poll_spy.calledOnce).true;
    expect(validation_spy.callCount).equals(1);
  });

  it('Creates a deployment and an environment to deploy to when an env does not exist with env and platform flags', async () => {
    moxios.stubRequest(`/accounts/test-account`, {
      status: 200,
      response: {
        id: 'test-account-id'
      },
    });

    moxios.stubRequest(`/accounts/test-account-id/environments/test-env`, {
      status: 404,
    });

    moxios.stubRequest(`/accounts/test-account-id/platforms/test-platform`, {
      status: 200,
      response: {
        id: 'test-platform-id'
      }
    });

    moxios.stubRequest(`/accounts/test-account-id/environments`, {
      status: 200,
      response: {
        id: 'test-env-id'
      }
    });

    moxios.stubRequest(`/environments/test-env-id/deploy`, {
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

    const validation_spy = sinon.fake.returns(true);
    sinon.replace(Deploy.prototype, 'validateNamespacedInput', validation_spy);

    await Deploy.run([calculator_env_config_path, '-e', 'test-account/test-env', '-p', 'test-account/test-platform', '--auto_approve']);
    expect(poll_spy.calledOnce).true;
    expect(validation_spy.callCount).equals(2);
  });

  it('Creates a deployment when env exists with only env flag', async () => {
    moxios.stubRequest(`/accounts/test-account`, {
      status: 200,
      response: {
        id: 'test-account-id'
      },
    });

    moxios.stubRequest(`/accounts/test-account-id/environments/test-env`, {
      status: 200,
      response: {
        id: 'test-env-id'
      },
    });

    moxios.stubRequest(`/environments/test-env-id/deploy`, {
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

    const validation_spy = sinon.fake.returns(true);
    sinon.replace(Deploy.prototype, 'validateNamespacedInput', validation_spy);

    await Deploy.run([calculator_env_config_path, '-e', 'test-account/test-env', '--auto_approve']);
    expect(poll_spy.calledOnce).true;
    expect(validation_spy.callCount).equals(1);
  });

  it('Creates a deployment and an environment to deploy to when an env does not exist with only env flag', async () => {
    moxios.stubRequest(`/accounts/test-account`, {
      status: 200,
      response: {
        id: 'test-account-id'
      },
    });

    moxios.stubRequest(`/accounts/test-account-id/environments/test-env`, {
      status: 404,
    });

    const inquirerStub = sinon.stub(inquirer, 'prompt');
    inquirerStub.resolves({
      platform_name: 'test-account/test-platform'
    });

    moxios.stubRequest(`/accounts/test-account-id/platforms/test-platform`, {
      status: 200,
      response: {
        id: 'test-platform-id'
      }
    });

    moxios.stubRequest(`/accounts/test-account-id/environments`, {
      status: 200,
      response: {
        id: 'test-env-id'
      }
    });

    moxios.stubRequest(`/environments/test-env-id/deploy`, {
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

    const validation_spy = sinon.fake.returns(true);
    sinon.replace(Deploy.prototype, 'validateNamespacedInput', validation_spy);

    await Deploy.run([calculator_env_config_path, '-e', 'test-account/test-env', '--auto_approve']);
    expect(poll_spy.calledOnce).true;
    expect(validation_spy.callCount).equals(1);
  });

  it('Creates a deployment and finds the env to use when only the platform flag is used', async () => {
    const inquirerStub = sinon.stub(inquirer, 'prompt');
    inquirerStub.resolves({
      environment_name: 'test-account/test-env'
    });

    moxios.stubRequest(`/accounts/test-account`, {
      status: 200,
      response: {
        id: 'test-account-id'
      },
    });

    moxios.stubRequest(`/accounts/test-account-id/environments/test-env`, {
      status: 200,
      response: {
        id: 'test-env-id'
      },
    });

    moxios.stubRequest(`/environments/test-env-id/deploy`, {
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

    const validation_spy = sinon.fake.returns(true);
    sinon.replace(Deploy.prototype, 'validateNamespacedInput', validation_spy);

    await Deploy.run([calculator_env_config_path, '-p', 'test-account/test-platform', '--auto_approve']);
    expect(poll_spy.calledOnce).true;
    expect(validation_spy.callCount).equals(2);
  });

  it('Bad environment account/name input throws an error explaining proper formatting', async () => {
    moxios.stubRequest(`/accounts/test-account`, {
      status: 200,
      response: {
        id: 'test-account-id'
      },
    });

    try {
      await Deploy.run([calculator_env_config_path, '-e', 'test-account/test-env::', '--auto_approve'])
    } catch (err) {
      expect(err.message).to.equal(`Each part of name must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character`);
    }
  });
});
