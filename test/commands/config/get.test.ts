import {expect} from '@oclif/test';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import AppConfig from '../../../src/app-config/config';
import sinon from 'sinon';
import ConfigGet from '../../../src/commands/config/get';
import AppService from '../../../src/app-config/service';
import ARCHITECTPATHS from '../../../src/paths';

describe('config:get', function() {
  afterEach(function() {
    sinon.restore();
  })

  it('expects default values', async () => {
    // Save a temporary config file and mock the app service to read from it
    const config = new AppConfig();
    const tmp_config_dir = os.tmpdir();
    const tmp_config_file = path.join(tmp_config_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);

    for (const key of Object.keys(config)) {
      const app_config_stub = sinon.stub().resolves(new AppService(tmp_config_dir));
      const logSpy = sinon.fake.returns(null);
      sinon.replace(ConfigGet.prototype, 'log', logSpy);
      sinon.replace(AppService, 'create', app_config_stub);

      await ConfigGet.run([key]);
      expect(logSpy.calledOnce).to.equal(true);
      expect(logSpy.firstCall.args[0]).to.equal(config[key]);

      sinon.restore();
    }

    fs.removeSync(tmp_config_file);
  });

  it('expects custom values', async () => {
    // Save a temporary config file and mock the app service to read from it
    const config = new AppConfig({
      registry_host: 'registry.config.test',
      api_host: 'https://registry.config.test',
      log_level: 'test',
    });
    const tmp_config_dir = os.tmpdir();
    const tmp_config_file = path.join(tmp_config_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);

    for (const key of Object.keys(config)) {
      const app_config_spy = sinon.fake.resolves(new AppService(tmp_config_dir));
      const logSpy = sinon.fake.returns(null);
      sinon.replace(AppService, 'create', app_config_spy);
      sinon.replace(ConfigGet.prototype, 'log', logSpy);

      await ConfigGet.run([key]);
      expect(app_config_spy.calledOnce).to.equal(true);
      expect(logSpy.calledOnce).to.equal(true);
      expect(logSpy.firstCall.args[0]).to.equal(config[key]);

      sinon.restore();
    }

    fs.removeSync(tmp_config_file);
  });
});
