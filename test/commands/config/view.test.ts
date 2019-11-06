import Table from 'cli-table3';
import sinon from 'sinon';
import {expect, test} from '@oclif/test';
import AppConfig from '../../../src/app-config/config';
import AppService from '../../../src/app-config/service';

describe('config:view', () => {
  test
    .stdout()
    .command(['config'])
    .it('renders table', ctx => {
      sinon.stub(AppService, 'create').returns(Promise.resolve(new AppService('')));
      const config = new AppConfig();

      const table = new Table({ head: ['Name', 'Value'] });
      for (const entry of Object.entries(config)) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        table.push(entry);
      }

      expect(ctx.stdout).to.equal(table.toString());
    })
})
