import { expect, test } from '@oclif/test';
import { MOCK_API_HOST } from '../../utils/mocks';

describe('secrets', function () {
  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

  const account = {
    id: "aa440d39-97d9-43c3-9f1a-a9a69adb2a41",
    name: "examples"
  }

  const environment = {
    id: 'ee475441-a499-4646-b553-7ce8dd476e92',
    name: 'env',
    account: account
  }

  const admin_user = {
    memberships: [
      {
        role: 'OWNER',
        account: account
      },
    ],
  }

  const member_user = {
    memberships: [
      {
        role: 'MEMBER',
        account: account
      },
    ],
  }

  const account_secrets = [
    {
      scope: '*',
      key: 'my-secret',
      value: 'a-val',
      account: account
    },
    {
      scope: 'cloud/*',
      key: 'secret',
      value: 'acc-secret-val',
      account: account
    }
  ]

  const environment_secrets = [
    {
      scope: '*',
      key: 'my-secret',
      value: 'e-val',
      environment: environment
    }
  ]

  const defaults = test
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}`)
      .reply(200, account))
  
  defaults
    .nock(MOCK_API_HOST, api => api
      .get(`/users/me`)
      .reply(200, admin_user))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/secrets/values`)
      .reply(200, account_secrets))
    .stdout({ print })
    .stderr({ print })
    .command(['secrets', '-a', 'examples'])
    .it('download account secrets successfully', ctx => {
      expect(ctx.stdout).to.contain('Successfully downloaded secrets')
    })
  
  defaults
    .nock(MOCK_API_HOST, api => api
      .get(`/users/me`)
      .reply(200, admin_user))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/environments/${environment.name}`)
      .reply(200, environment))
    .nock(MOCK_API_HOST, api => api
      .get(`/environments/${environment.id}/secrets/values`)
      .reply(200, environment_secrets))
    .stdout({ print })
    .stderr({ print })
    .command(['secrets', '-a', 'examples', '-e', 'env'])
    .it('download environment secrets successfully with default filename', ctx => {
      expect(ctx.stdout).to.contain('Successfully downloaded secrets')
      expect(ctx.stdout).to.contain('secrets.yml')
    })
  
  defaults
    .nock(MOCK_API_HOST, api => api
      .get(`/users/me`)
      .reply(200, admin_user))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/environments/${environment.name}`)
      .reply(200, environment))
    .nock(MOCK_API_HOST, api => api
      .get(`/environments/${environment.id}/secrets/values`)
      .reply(200, environment_secrets))
    .stdout({ print })
    .stderr({ print })
    .command(['secrets', '-a', 'examples', '-e', 'env', './my-secrets.yml'])
    .it('download environment secrets successfully with provided filename', ctx => {
      expect(ctx.stdout).to.contain('Successfully downloaded secrets')
      expect(ctx.stdout).to.contain('my-secrets.yml')
    })
  
  defaults
    .nock(MOCK_API_HOST, api => api
      .get(`/users/me`)
      .reply(200, member_user))
    .stdout({ print })
    .stderr({ print })
    .command(['secrets', '-a', 'examples'])
    .catch(ctx => {
      expect(ctx.message).to.contain('You do not have permission to download secrets')
    })
    .it('download account secrets failed due to permission');
});
