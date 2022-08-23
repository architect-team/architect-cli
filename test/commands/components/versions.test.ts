import { expect } from '@oclif/test';
import sinon, { SinonSpy } from 'sinon';
import AccountUtils from '../../../src/architect/account/account.utils';
import BaseTable from '../../../src/base-table';
import ComponentVersions from '../../../src/commands/components/versions';
import { mockArchitectAuth, MOCK_API_HOST } from '../../utils/mocks';

describe('list component versions', () => {
  const component = {
    name: 'test-component',
    account: {
      name: 'test-account',
    },
    component_id: 'component-id',
  };

  const component_versions = [
    {
      tag: '0.0.1',
      created_at: '5/2/22, 12:38:32 AM EDT',
    },
    {
      tag: '0.0.2',
      created_at: '5/2/22, 11:38:51 AM EDT',
    },
    {
      tag: 'latest',
      created_at: '5/2/22, 11:38:32 AM EDT',
    },
  ];

  const header = { head: ['Tag', 'Created'] };
  const full_table = new BaseTable(header);
  for (const entry of component_versions) {
    full_table.push([entry.tag, entry.created_at ]);
  }

  mockArchitectAuth
    .stub(AccountUtils, 'getAccount', sinon.stub().returns(component.account))
    .stub(ComponentVersions.prototype, 'log', sinon.fake.returns(null))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${component.account.name}/components/${component.name}`)
      .reply(200, component))
    .nock(MOCK_API_HOST, api => api
      .get(`/components/${component.component_id}/versions`)
      .reply(200, { rows: component_versions, count: component_versions.length }))
    .command(['component:versions', 'test-component'])
    .it('list all component versions', () => {
      const get_account = AccountUtils.getAccount as SinonSpy;
      expect(get_account.getCalls().length).to.equal(1);

      const log_spy_list = ComponentVersions.prototype.log as SinonSpy;
      expect(log_spy_list.firstCall.args[0]).to.equal(full_table.toString());
    });
});
