import { expect } from '@oclif/test';
import sinon, { SinonSpy } from 'sinon';
import BaseTable from '../../../src/base-table';
import Environments from '../../../src/commands/environments/index';
import localizedTimestamp from '../../../src/common/utils/localized-timestamp';
import { MockArchitectApi } from '../../utils/mocks';

describe('environments', () => {
  const mock_account = {
    name: 'architect',
  };

  const mock_environments = [
    {
      name: 'example-environment',
      namespace: 'arc-architect--example-environment',
      account: {
        name: 'architect'
      },
      created_at: (new Date()).toString(),
      updated_at: (new Date()).toString(),
    },
    {
      name: 'example-environment',
      namespace: 'arc-architect-staging--example-environment',
      account: {
        name: 'architect-staging',
      },
      created_at: (new Date()).toString(),
      updated_at: (new Date()).toString(),
    },
    {
      name: 'production',
      namespace: 'arc-architect--production',
      account: {
        name: 'architect',
      },
      created_at: (new Date()).toString(),
      updated_at: (new Date()).toString(),
    }
  ];

  new MockArchitectApi()
    .getEnvironments()
    .getApiMocks()
    .command(['environments'])
    .it('list environments', ctx => {
      expect(ctx.stdout).to.contain('You have not configured any environments');
    });

  new MockArchitectApi()
    .getEnvironments([], { query: mock_account.name })
    .getApiMocks()
    .command(['environments', mock_account.name])
    .it('list environments for account if none exist', ctx => {
      expect(ctx.stdout).to.contain('No environments found matching architect');
    });

  new MockArchitectApi()
    .getEnvironments(mock_environments, { query: mock_account.name })
    .getApiMocks()
    .stub(Environments.prototype, 'log', sinon.fake.returns(null))
    .command(['environments', mock_account.name])
    .it('list environments for account', ctx => {
      const table = new BaseTable({ head: ['Name', 'Account', 'Namespace', 'Created', 'Updated'] });
      for (const env of mock_environments) {
        table.push([
          env.name,
          env.account.name,
          env.namespace,
          localizedTimestamp(env.created_at),
          localizedTimestamp(env.updated_at),
        ]);
      }
      const environment_list_spy = Environments.prototype.log as SinonSpy;
      expect(environment_list_spy.firstCall.args[0]).to.equal(table.toString());
    });
});
