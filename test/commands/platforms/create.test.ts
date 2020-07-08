import { expect } from '@oclif/test';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import moxios from 'moxios';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import AppConfig from '../../../src/app-config/config';
import CredentialManager from '../../../src/app-config/credentials';
import AppService from '../../../src/app-config/service';
import PlatformCreate from '../../../src/commands/platforms/create';
import PortUtil from '../../../src/common/utils/port';
import ARCHITECTPATHS from '../../../src/paths';

describe('platform:create', function () {
  let tmp_dir = os.tmpdir();

  beforeEach(() => {
    // Stub the logger
    sinon.replace(PlatformCreate.prototype, 'log', sinon.stub());
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

  it('Creates a new public platform when account/name arg is included', async () => {

    moxios.stubRequest(`/accounts`, {
      status: 200,
      response: {
        count: 1,
        rows: [{
          id: 'test-account-id',
          name: 'test-account-name'
        }]
      },
    });

    moxios.stubRequest(`/accounts/test-account-id/platforms/public`, {
      status: 200,
      response: {
        id: 'test-platform-id',
        account: {
          name: 'test-account-name'
        }
      }
    });

    const create_platform_spy = sinon.fake.returns({});
    sinon.replace(PlatformCreate.prototype, 'create_architect_platform', create_platform_spy);

    await PlatformCreate.run(['test-account-name/platform-name', '-t', 'architect_public']);
    expect(create_platform_spy.calledOnce).true;
  });

  it('Creates a new public platform when account/name arg is not included', async () => {

    const inquirerStub = sinon.stub(inquirer, 'prompt');
    inquirerStub.resolves({
      account: {
        name: 'test-account-name',
        id: 'test-account-id',
      },
      name: 'platform-name'
    });

    moxios.stubRequest(`/accounts`, {
      status: 200,
      response: {
        count: 1,
        rows: [{
          id: 'test-account-id',
          name: 'test-account-name'
        }]
      },
    });

    moxios.stubRequest(`/accounts/test-account-id/platforms/public`, {
      status: 200,
      response: {
        id: 'test-platform-id',
        account: {
          name: 'test-account-name'
        }
      }
    });

    const create_platform_spy = sinon.fake.returns({});
    sinon.replace(PlatformCreate.prototype, 'create_architect_platform', create_platform_spy);

    await PlatformCreate.run(['-t', 'architect_public']);
    expect(create_platform_spy.calledOnce).true;
  });
});
