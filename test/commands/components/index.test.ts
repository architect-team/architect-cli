import { expect } from '@oclif/test';
import sinon, { SinonSpy } from 'sinon';
import BaseTable from '../../../src/base-table';
import Components from '../../../src/commands/components/index';
import { mockArchitectAuth, MOCK_API_HOST } from '../../utils/mocks';

describe('list components', () => {
  const components = [
    {
      name: 'another',
      account: {
        name: 'account2'
      },
      created_at: '5/2/22, 12:38:32 AM EDT',
      updated_at: '5/6/22, 12:44:51 AM EDT',
    },
    {
      name: 'component1',
      account: {
        name: 'account1'
      },
      created_at: '5/2/22, 11:38:51 AM EDT',
      updated_at: '5/4/22, 11:38:51 AM EDT',
    },
    {
      name: 'component2',
      account: {
        name: 'account1'
      },
      created_at: '5/2/22, 11:38:32 AM EDT',
      updated_at: '5/4/22, 11:44:51 AM EDT',
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
    .nock(MOCK_API_HOST, api => api
      .get(`/components?q=`)
      .reply(200, { rows: components, count: components.length }))
    .command(['components'])
    .it('list all components', () => {
      const log_spy_list = Components.prototype.log as SinonSpy;
      expect(log_spy_list.firstCall.args[0]).to.equal(full_table.toString());
    });

  mockArchitectAuth
    .stub(Components.prototype, 'log', sinon.fake.returns(null))
    .nock(MOCK_API_HOST, api => api
      .get(`/components?q=another`)
      .reply(200, { rows: [components[2]], count: 1 }))
    .command(['components', 'another'])
    .it('list queried components', () => {
      const log_spy_list = Components.prototype.log as SinonSpy;
      expect(log_spy_list.firstCall.args[0]).to.equal(query_table.toString());
    });
});
