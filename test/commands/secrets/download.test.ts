import { expect, test } from '@oclif/test';
import fs from 'fs-extra';
import sinon, { SinonSpy } from 'sinon';
import untildify from 'untildify';
import UserUtils from '../../../src/architect/user/user.utils';
import { MOCK_API_HOST } from '../../utils/mocks';

describe('secrets', function () {
  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

  const download_location = untildify('~/secrets.yml');

  const account = {
    id: "aa440d39-97d9-43c3-9f1a-a9a69adb2a41",
    name: "examples"
  }

  const environment = {
    id: 'ee475441-a499-4646-b553-7ce8dd476e92',
    name: 'env',
    account: account
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

  const environment_secrets_w_inheritance = [
    {
      scope: 'cloud/*',
      key: 'secret',
      value: 'override',
      environment: environment
    },
    {
      scope: '*',
      key: 'acc-secret',
      value: 'acc-secret-val',
      account: account
    }
  ]

  const defaults = test
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}`)
      .reply(200, account))

  defaults
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(fs, 'writeFileSync', sinon.stub())
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/secrets/values`)
      .reply(200, account_secrets))
    .stdout({ print })
    .stderr({ print })
    .command(['secrets', '-a', 'examples', download_location])
    .it('download account secrets successfully', async ctx => {
      const expected_account_secrets = {
        'cloud/*': {
          secret: 'secret-val'
        },
        '*': {
          'acc-secret': 'acc-secret-val'
        }
      }

      const fs_spy = fs.writeFileSync as SinonSpy;
      expect(ctx.stdout).to.contain(`Secrets have been downloaded`);
      expect(fs_spy.calledOnce).to.be.true;
      expect(fs_spy.calledWith(download_location, expected_account_secrets))
    })

  defaults
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(fs, 'writeFileSync', sinon.stub())
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/environments/${environment.name}`)
      .reply(200, environment))
    .nock(MOCK_API_HOST, api => api
      .get(`/environments/${environment.id}/secrets/values?inherited=true`)
      .reply(200, environment_secrets_w_inheritance))
    .stdout({ print })
    .stderr({ print })
    .command(['secrets', '-a', 'examples', '-e', 'env', download_location])
    .it('download environment secrets successfully', async ctx => {
      const expected_env_secrets = {
        'cloud/*': {
          secret: 'override'
        },
        '*': {
          'acc-secret': 'acc-secret-val'
        }
      }

      const fs_spy = fs.writeFileSync as SinonSpy;
      expect(ctx.stdout).to.contain(`Secrets have been downloaded`);
      expect(fs_spy.calledOnce).to.be.true;
      expect(fs_spy.calledWith(download_location, expected_env_secrets))
    })

  defaults
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(fs, 'writeFileSync', sinon.stub())
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/environments/${environment.name}`)
      .reply(200, environment))
    .nock(MOCK_API_HOST, api => api
      .get(`/environments/${environment.id}/secrets/values?inherited=true`)
      .reply(200, []))
    .stdout({ print })
    .stderr({ print })
    .command(['secrets', '-a', 'examples', '-e', 'env', download_location])
    .it('download environment secrets failed when there are no secrets', ctx => {
      expect(ctx.stdout).to.contain('There are no secrets to download');
    })

  defaults
    .stub(UserUtils, 'isAdmin', async () => false)
    .stdout({ print })
    .stderr({ print })
    .command(['secrets', '-a', 'examples', download_location])
    .catch(ctx => {
      expect(ctx.message).to.contain('You do not have permission to download secrets')
    })
    .it('download account secrets failed due to permission');
});
