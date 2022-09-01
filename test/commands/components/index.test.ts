import { expect } from '@oclif/test';
import sinon, { SinonSpy } from 'sinon';
import BaseTable from '../../../src/base-table';
import Components from '../../../src/commands/components/index';
import { mockArchitectAuth, MOCK_API_HOST } from '../../utils/mocks';
import * as LocalizedTimestamp from '../../../src/common/utils/localized-timestamp';

describe('list components', () => {
  const date = '5/2/22, 12:38:32 AM UTC';
  const components = [
    {
      name: 'another',
      account: {
        name: 'account2'
      },
      created_at: date,
      updated_at: date,
    },
    {
      name: 'component1',
      account: {
        name: 'account1'
      },
      created_at: date,
      updated_at: date,
    },
    {
      name: 'component2',
      account: {
        name: 'account1'
      },
      created_at: date,
      updated_at: date,
    },
  ];

  const header = { head: ['Name', 'Account', 'Created', 'Updated'] };
  const full_table = new BaseTable(header);
  for (const entry of components) {
    full_table.push([entry.name, entry.account.name, entry.created_at, entry.updated_at ]);
  }
  const query_table = new BaseTable(header);
  query_table.push([components[2].name, components[2].account.name, components[2].created_at, components[2].updated_at ]);

  mockArchitectAuth
    .stub(Components.prototype, 'log', sinon.fake.returns(null))
    .stub(LocalizedTimestamp, 'default', sinon.stub().returns(date))
    .nock(MOCK_API_HOST, api => api
      .get(`/components?q=`)
      .reply(200, { rows: components, count: components.length }))
    .timeout(20000)
    .command(['components'])
    .it('list all components', () => {
      const log_spy_list = Components.prototype.log as SinonSpy;
      expect(log_spy_list.firstCall.args[0]).to.equal(full_table.toString());
    });

  mockArchitectAuth
    .stub(Components.prototype, 'log', sinon.fake.returns(null))
    .stub(LocalizedTimestamp, 'default', sinon.stub().returns(date))
    .nock(MOCK_API_HOST, api => api
      .get(`/components?q=another`)
      .reply(200, { rows: [components[2]], count: 1 }))
    .command(['components', 'another'])
    .it('list queried components', () => {
      const log_spy_list = Components.prototype.log as SinonSpy;
      expect(log_spy_list.firstCall.args[0]).to.equal(query_table.toString());
    });
});
