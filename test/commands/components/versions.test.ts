import { expect } from '@oclif/test';
import sinon, { SinonSpy } from 'sinon';
import AccountUtils from '../../../src/architect/account/account.utils';
import BaseTable from '../../../src/base-table';
import ComponentVersions from '../../../src/commands/components/versions';
import * as LocalizedTimestamp from '../../../src/common/utils/localized-timestamp';
import { MockArchitectApi } from '../../utils/mocks';

describe('list component versions', () => {
  const component = {
    name: 'test-component',
    account: {
      name: 'test-account',
    },
    component_id: 'component-id',
  };

  const date = '5/2/22, 12:38:32 AM UTC';
  const component_versions = [
    {
      tag: '0.0.1',
      created_at: date,
    },
    {
      tag: '0.0.2',
      created_at: date,
    },
    {
      tag: 'latest',
      created_at: date,
    },
  ];

  const header = { head: ['Tag', 'Created'] };
  const full_table = new BaseTable(header);
  for (const entry of component_versions) {
    full_table.push([entry.tag, entry.created_at]);
  }

  new MockArchitectApi()
    .getComponent(component.account, component)
    .getComponentVersions(component, component_versions)
    .getTests()
    .stub(AccountUtils, 'getAccount', sinon.stub().returns(component.account))
    .stub(LocalizedTimestamp, 'default', sinon.stub().returns(date))
    .stub(ComponentVersions.prototype, 'log', sinon.fake.returns(null))
    .command(['component:versions', 'test-component'])
    .it('list all component versions', () => {
      const get_account = AccountUtils.getAccount as SinonSpy;
      expect(get_account.getCalls().length).to.equal(1);

      const log_spy_list = ComponentVersions.prototype.log as SinonSpy;
      expect(log_spy_list.firstCall.args[0]).to.equal(full_table.toString());
    });
});
