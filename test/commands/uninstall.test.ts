import {expect, test} from '@oclif/test';
import Uninstall from '../../src/commands/uninstall';
import sinon from 'sinon';
import os from 'os';
import fs from 'fs-extra';
import path from 'path';
import AppConfig from '../../src/app-config/config';
import ARCHITECTPATHS from '../../src/paths';
import AppService from '../../src/app-config/service';

describe('uninstall', () => {
  let tmp_dir = os.tmpdir();

  beforeEach(function() {
    // Stub the log_level
    const config = new AppConfig({
      log_level: 'debug',
    });
    const tmp_config_file = path.join(tmp_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);
    const app_config_stub = sinon.stub().resolves(new AppService(tmp_dir));
    sinon.replace(AppService, 'create', app_config_stub);
  });

  afterEach(function() {
    // Restore stubs
    sinon.restore();

    // Remove the registry_host stub
    fs.removeSync(path.join(tmp_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME));
  });

  it('fails on invalid service directory', async () => {
    try {
      await Uninstall.run(['-s', __dirname]);
      expect(false, 'no error thrown').to.equal(true);
    } catch (err) {
      expect(err.name).to.equal('missing_config_file');
      expect(err.message).to.equal(`No config file found at ${path.join(__dirname, ARCHITECTPATHS.SERVICE_CONFIG_FILENAME)}`);
    }
  });
});
