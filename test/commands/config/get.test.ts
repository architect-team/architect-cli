import { expect } from '@oclif/test';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import AppConfig from '../../../src/app-config/config';
import CredentialManager from '../../../src/app-config/credentials';
import AppService from '../../../src/app-config/service';
import ConfigGet from '../../../src/commands/config/get';
import ARCHITECTPATHS from '../../../src/paths';

const expectValueForField = async (tmp_config_dir: string, key: string, value: string) => {
  const app_config_stub = sinon.stub().resolves(new AppService(tmp_config_dir));
  const logSpy = sinon.fake.returns(null);
  sinon.replace(ConfigGet.prototype, 'log', logSpy);
  sinon.replace(AppService, 'create', app_config_stub);

  await ConfigGet.run([key]);
  expect(logSpy.calledOnce).to.equal(true);
  expect(logSpy.firstCall.args[0]).to.equal(value);

  sinon.restore();
};

const expectConfigValues = async (config_dir: string, config: AppConfig) => {
  await expectValueForField(config_dir, 'log_level', config.log_level);
  await expectValueForField(config_dir, 'registry_host', config.registry_host);
  await expectValueForField(config_dir, 'api_host', config.api_host);
  await expectValueForField(config_dir, 'oauth_domain', config.oauth_domain);
  await expectValueForField(config_dir, 'oauth_client_id', config.oauth_client_id);
};

describe('config:get', function () {
  afterEach(function () {
    sinon.restore();
  });

  beforeEach(function () {
    const credential_spy = sinon.fake.returns('token');
    sinon.replace(CredentialManager.prototype, 'get', credential_spy);
  });

  it('expects default values', async () => {
    // Save a temporary config file and mock the app service to read from it
    const config = new AppConfig('');
    const tmp_config_dir = os.tmpdir();
    const tmp_config_file = path.join(tmp_config_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);
    await expectConfigValues(tmp_config_dir, config);
    fs.removeSync(tmp_config_file);
  });

  it('expects custom values', async () => {
    // Save a temporary config file and mock the app service to read from it
    const config = new AppConfig('', {
      registry_host: 'registry.config.test',
      api_host: 'https://registry.config.test',
      log_level: 'test',
    });
    const tmp_config_dir = os.tmpdir();
    const tmp_config_file = path.join(tmp_config_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);
    await expectConfigValues(tmp_config_dir, config);
    fs.removeSync(tmp_config_file);
  });
});
