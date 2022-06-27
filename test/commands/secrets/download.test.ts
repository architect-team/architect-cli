import os from 'os';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import { expect, test } from '@oclif/test';
import { Dictionary } from '../../../src';
import { MOCK_API_HOST } from '../../utils/mocks';
import UserUtils from '../../../src/architect/user/user.utils';

function delay(time: number) {
  return new Promise(resolve => setTimeout(resolve, time));
} 

describe('secrets', function () {
  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

  let tmp_dir = os.tmpdir();

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
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/secrets/values`)
      .reply(200, account_secrets))
    .stdout({ print })
    .stderr({ print })
    .command(['secrets', '-a', 'examples', `${tmp_dir}/my-secrets.yml`])
    .it('download account secrets successfully', async ctx => {
      await delay(500);

      const expected_account_secrets = {
        'cloud/*': {
          secret: 'secret-val'
        },
        '*': {
          'acc-secret': 'acc-secret-val'
        }
      }

      expect(ctx.stdout).to.contain(`Secrets have been downloaded`);
      const yml_file = `${tmp_dir}/my-secrets.yml`;
      const loaded_yml = yaml.load(fs.readFileSync(yml_file).toString()) as Dictionary<Dictionary<string>>;
      expect(loaded_yml).to.be.deep.equal(expected_account_secrets);
    })

  defaults
    .stub(UserUtils, 'isAdmin', async () => true)
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/environments/${environment.name}`)
      .reply(200, environment))
    .nock(MOCK_API_HOST, api => api
      .get(`/environments/${environment.id}/secrets/values?inherited=true`)
      .reply(200, environment_secrets_w_inheritance))
    .stdout({ print })
    .stderr({ print })
    .command(['secrets', '-a', 'examples', '-e', 'env', `${tmp_dir}/my-secrets.yml`])
    .it('download environment secrets successfully', async ctx => {
      await delay(500);

      const expected_env_secrets = {
        'cloud/*': {
          secret: 'override'
        },
        '*': {
          'acc-secret': 'acc-secret-val'
        }
      }

      expect(ctx.stdout).to.contain(`Secrets have been downloaded`);
      const yml_file = `${tmp_dir}/my-secrets.yml`;
      const loaded_yml = yaml.load(fs.readFileSync(yml_file).toString()) as Dictionary<Dictionary<string>>;
      expect(loaded_yml).to.be.deep.equal(expected_env_secrets);
    })

  defaults
    .stub(UserUtils, 'isAdmin', async () => true)
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/environments/${environment.name}`)
      .reply(200, environment))
    .nock(MOCK_API_HOST, api => api
      .get(`/environments/${environment.id}/secrets/values?inherited=true`)
      .reply(200, []))
    .stdout({ print })
    .stderr({ print })
    .command(['secrets', '-a', 'examples', '-e', 'env', `${tmp_dir}/my-secrets.yml`])
    .it('download environment secrets failed when there are no secrets', ctx => {
      expect(ctx.stdout).to.contain('There are no secrets to download');
    })
  
  defaults
    .nock(MOCK_API_HOST, api => api
      .get(`/users/me`)
      .reply(200, member_user))
    .stdout({ print })
    .stderr({ print })
    .command(['secrets', '-a', 'examples', `${tmp_dir}/my-secrets.yml`])
    .catch(ctx => {
      expect(ctx.message).to.contain('You do not have permission to download secrets')
    })
    .it('download account secrets failed due to permission');
});
