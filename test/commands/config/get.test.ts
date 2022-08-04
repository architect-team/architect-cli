import { expect } from '@oclif/test';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import AppConfig from '../../../src/app-config/config';
import AppService from '../../../src/app-config/service';
import ConfigGet from '../../../src/commands/config/get';
import ARCHITECTPATHS from '../../../src/paths';

const expectValueForField = async (tmp_config_dir: string, key: string, value: string) => {
  const app_config_stub = sinon.stub().returns(new AppService(tmp_config_dir, '0.0.1'));
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
  await expectValueForField(config_dir, 'oauth_host', config.oauth_host);
  await expectValueForField(config_dir, 'oauth_client_id', config.oauth_client_id);
  await expectValueForField(config_dir, 'account', config.account);
};

describe('config:get', function () {
  this.timeout(20000); // otherwise this fails occaisionally in github actions at default 5000 timeout

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
