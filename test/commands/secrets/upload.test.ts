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
      scope: 'cloud/*',
      key: 'secret',
      value: 'secret-val',
      account: account
    },
    {
      scope: '*',
      key: 'acc-secret',
      value: 'acc-secret-val',
      account: account
    }
  ]

  const environment_secrets = [
    {
      scope: '*',
      key: 'secret',
      value: 'secret-val',
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
    .nock(MOCK_API_HOST, api => api
      .post(`/accounts/${account.id}/secrets/batch`)
      .reply(200, {}))
    .stdout({ print })
    .stderr({ print })
    .command(['secrets:set', '-a', 'examples', './test/mocks/secrets/account-secrets.yml'])
    .it('upload account secrets successfully', ctx => {
      const secrets = JSON.parse(ctx.stdout);
      expect(secrets).to.have.lengthOf(1);
      expect(secrets[0]).to.deep.eq({
        scope: '*',
        key: 'new-secret',
        value: 'new-secret-val',
      })
    })
  
  defaults
    .nock(MOCK_API_HOST, api => api
      .get(`/users/me`)
      .reply(200, admin_user))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/secrets/values`)
      .reply(200, account_secrets))
    .nock(MOCK_API_HOST, api => api
      .post(`/accounts/${account.id}/secrets/batch`)
      .reply(200, {}))
    .stdout({ print })
    .stderr({ print })
    .command(['secrets:set', '-a', 'examples', '--override', './test/mocks/secrets/account-secrets.yml'])
    .it('upload account secrets successfully with override', ctx => {
      const secrets = JSON.parse(ctx.stdout);
      const override_secret = secrets.filter((s: any) => s.scope === 'cloud/*' && s.key === 'secret');
      expect(override_secret).to.have.lengthOf(1);
      expect(override_secret[0].value).to.eq('override')
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
    .nock(MOCK_API_HOST, api => api
      .post(`/environments/${environment.id}/secrets/batch`)
      .reply(200, {}))
    .stdout({ print })
    .stderr({ print })
    .command(['secrets:set', '-a', 'examples', '-e', 'env', './test/mocks/secrets/environment-secrets.yml'])
    .it('upload environment secrets successfully', ctx => {
      const secrets = JSON.parse(ctx.stdout);
      expect(secrets).to.have.lengthOf(1);
      expect(secrets[0]).to.deep.eq({
        scope: '*',
        key: 'new-secret',
        value: 'new-secret-val',
      })
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
    .nock(MOCK_API_HOST, api => api
      .post(`/environments/${environment.id}/secrets/batch`)
      .reply(200, {}))
    .stdout({ print })
    .stderr({ print })
    .command(['secrets:set', '-a', 'examples', '-e', 'env', '--override', './test/mocks/secrets/environment-secrets.yml'])
    .it('upload environment secrets successfully with override', ctx => {
      const secrets = JSON.parse(ctx.stdout);
      const override_secret = secrets.filter((s: any) => s.scope === '*' && s.key === 'secret');
      expect(override_secret).to.have.lengthOf(1);
      expect(override_secret[0].value).to.eq('override')
    })
  
  defaults
    .nock(MOCK_API_HOST, api => api
      .get(`/users/me`)
      .reply(200, member_user))
    .stdout({ print })
    .stderr({ print })
    .command(['secrets', '-a', 'examples', './test/mocks/secrets/account-secrets.yml'])
    .catch(ctx => {
      expect(ctx.message).to.contain('You do not have permission to download secrets')
    })
    .it('upload account secrets failed due to permission');
});
