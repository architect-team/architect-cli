import { expect, test } from '@oclif/test';
import Table from 'cli-table3';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import AppConfig from '../../../src/app-config/config';
import AppService from '../../../src/app-config/service';
import ConfigView from '../../../src/commands/config/view';
import ARCHITECTPATHS from '../../../src/paths';

describe('config:view', () => {
  describe('expects results table', () => {
    const config = new AppConfig('', {
      registry_host: 'registry.config.test',
      api_host: 'https://registry.config.test',
      log_level: 'test',
    });
    const table = new Table({
      head: ['Name', 'Value'],
      style: {
        head: ['green']
      }
    });
    for (const entry of Object.entries(config.toJSON())) {
      table.push(entry);
    }

    // Save a temporary config file and mock the app service to read from it
    const tmp_config_dir = os.tmpdir();
    const tmp_config_file = path.join(tmp_config_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);

    const app_config_spy = sinon.fake.returns(new AppService(tmp_config_dir, '0.0.1'));
    const log_spy = sinon.fake.returns(null);

    // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
    const print = false;

    test
      .timeout(20000)
      .stub(AppService, 'create', app_config_spy)
      .stub(ConfigView.prototype, 'log', log_spy)
      .stderr({ print })
      .command(['config:view'])
      .it('calls app config and outputs expected log value', () => {
        expect(app_config_spy.calledOnce).to.equal(true);
        expect(log_spy.calledOnce).to.equal(true);
        expect(log_spy.firstCall.args[0]).to.equal(table.toString());
      });
  });
})
