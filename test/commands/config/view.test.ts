import { expect, test } from '@oclif/test';
import Table from 'cli-table3';
import fs from 'fs-extra';
import path from 'path';
import sinon from 'sinon';
import AppConfig from '../../../src/app-config/config';
import ConfigView from '../../../src/commands/config/view';

describe('config:view', () => {
  describe('expects results table', () => {
    const table = new Table({
      head: ['Name', 'Value'],
      style: {
        head: ['green']
      }
    });

    const overrides = fs.readJSONSync(path.resolve('./test/config.json'));
    const config = new AppConfig(path.resolve('./test'), overrides).toJSON();
    for (const entry of Object.entries(config)) {
      table.push(entry);
    }

    const log_spy = sinon.fake.returns(null);

    // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
    const print = false;

    test
      .timeout(20000)
      .stub(ConfigView.prototype, 'log', log_spy)
      .stderr({ print })
      .command(['config:view'])
      .it('calls app config and outputs expected log value', () => {
        expect(log_spy.calledOnce).to.equal(true);
        expect(log_spy.firstCall.args[0]).to.equal(table.toString());
      });
  });
})
