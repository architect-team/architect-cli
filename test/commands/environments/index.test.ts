import fs from 'fs-extra';
import nock from 'nock';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import AppConfig from '../../../src/app-config/config';
import AppService from '../../../src/app-config/service';
import Environments from '../../../src/commands/environments';
import ARCHITECTPATHS from '../../../src/paths';

describe('environments', () => {
  let tmp_dir = os.tmpdir();

  beforeEach(function () {
    const config = new AppConfig('', {});
    const tmp_config_file = path.join(tmp_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);
    const app_config_stub = sinon.stub().returns(new AppService(tmp_dir, '0.0.1'));
    sinon.replace(AppService, 'create', app_config_stub);
  });

  it('lists all environments', () => {
    nock('http://localhost').get('/environments')
      .reply(200, []);
    Environments.run([]);
  });

  it('supports search queries', () => {
    const search_term = 'architect';
    nock('http://localhost').get('/environments')
      .reply(200, []);
    Environments.run([search_term]);
  });
})
