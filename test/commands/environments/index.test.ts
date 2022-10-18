import { expect } from '@oclif/test';
import { mockArchitectAuth, MOCK_API_HOST } from '../../utils/mocks';

describe('environments', () => {

  const print = false;

  mockArchitectAuth()
    .nock(MOCK_API_HOST, api => api
      .get(`/environments?q=`)
      .reply(200, { rows: [], total: 0 }))
    .stdout({ print })
    .stderr({ print })
    .command(['environments'])
    .it('list environments', ctx => {
      expect(ctx.stdout).to.contain('You have not configured any environments')
    });

  mockArchitectAuth()
    .nock(MOCK_API_HOST, api => api
      .get(`/environments?q=architect`)
      .reply(200, { rows: [], total: 0 }))
    .stdout({ print })
    .stderr({ print })
    .command(['environments', 'architect'])
    .it('list environments for account', ctx => {
      expect(ctx.stdout).to.contain('No environments found matching architect')
    });
})
