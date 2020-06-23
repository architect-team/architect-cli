import { expect } from '@oclif/test';
import Table from 'cli-table3';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import AppConfig from '../../../src/app-config/config';
import CredentialManager from '../../../src/app-config/credentials';
import AppService from '../../../src/app-config/service';
import ConfigView from '../../../src/commands/config/view';
import ARCHITECTPATHS from '../../../src/paths';

describe('config:view', () => {
  afterEach(function () {
    sinon.restore();
  });

  beforeEach(function () {
    const credential_spy = sinon.fake.returns('token');
    sinon.replace(CredentialManager.prototype, 'get', credential_spy);
  });

  it('expects results table', async () => {
    const config = new AppConfig('', {
      registry_host: 'registry.config.test',
      api_host: 'https://registry.config.test',
      log_level: 'test',
    });
    const table = new Table({ head: ['Name', 'Value'] });
    for (const entry of Object.entries(config.toJSON())) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      table.push(entry);
    }

    // Save a temporary config file and mock the app service to read from it
    const tmp_config_dir = os.tmpdir();
    const tmp_config_file = path.join(tmp_config_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);

    // Watch for log results
    const app_config_spy = sinon.fake.resolves(new AppService(tmp_config_dir, '0.0.1'));
    const log_spy = sinon.fake.returns(null);
    sinon.replace(AppService, 'create', app_config_spy);
    sinon.replace(ConfigView.prototype, 'log', log_spy);

    await ConfigView.run();
    expect(app_config_spy.calledOnce).to.equal(true);
    expect(log_spy.calledOnce).to.equal(true);
    expect(log_spy.firstCall.args[0]).to.equal(table.toString());

    fs.removeSync(tmp_config_file);
  });
})
