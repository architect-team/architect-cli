import { expect, test } from '@oclif/test';
import fs from 'fs-extra';
import sinon, { SinonSpy } from 'sinon';
import untildify from 'untildify';
import UserUtils from '../../../src/architect/user/user.utils';
import { MOCK_API_HOST } from '../../utils/mocks';
import yaml from 'js-yaml';

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

  const platform = {
    id: '59db4eae-eb8a-4125-8834-7fb7b6208cbd',
    name: 'my-platform',
    account: account
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

  const platform_secrets_w_inheritance = [
    {
      scope: 'cloud/*',
      key: 'secret',
      value: 'platform-override',
      platform: platform
    },
    {
      scope: '*',
      key: 'platform-secret',
      value: 'platform-secret-val',
      platform: platform
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
      value: 'environment-override',
      environment: environment
    },
    {
      scope: '*',
      key: 'platform-secret',
      value: 'platform-secret-val',
      platform: platform
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
    .stub(fs, 'writeFileSync', sinon.spy())
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
      expect(fs_spy.calledWith(download_location, yaml.dump(expected_account_secrets))).to.be.true;
    })
  
  defaults
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(fs, 'writeFileSync', sinon.spy())
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/platforms/${platform.name}`)
      .reply(200, platform))
    .nock(MOCK_API_HOST, api => api
      .get(`/platforms/${platform.id}/secrets/values?inherited=true`)
      .reply(200, platform_secrets_w_inheritance))
    .stdout({ print })
    .stderr({ print })
    .command(['secrets', '-a', 'examples', '--platform', 'my-platform', download_location])
    .it('download platform secrets successfully', async ctx => {
      const expected_platform_secrets = {
        'cloud/*': {
          secret: 'platform-override'
        },
        '*': {
          'platform-secret': 'platform-secret-val',
          'acc-secret': 'acc-secret-val'
        }
      }

      const fs_spy = fs.writeFileSync as SinonSpy;
      expect(ctx.stdout).to.contain(`Secrets have been downloaded`);
      expect(fs_spy.calledOnce).to.be.true;
      expect(fs_spy.calledWith(download_location, yaml.dump(expected_platform_secrets))).to.be.true;
    })

  defaults
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(fs, 'writeFileSync', sinon.spy())
    .stdout({ print })
    .stderr({ print })
    .command(['secrets', '-a', 'examples', '--platform', 'non-existed-platform-name', download_location])
    .catch(ctx => {
      expect(ctx.message).to.contain('Failed to find secrets. Please ensure your platform or environment exists.')
    })
    .it('download platform secrets failed with non-existed platform');

  defaults
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(fs, 'writeFileSync', sinon.spy())
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/platforms/${platform.name}`)
      .reply(200, platform))
    .nock(MOCK_API_HOST, api => api
      .get(`/platforms/${platform.id}/secrets/values?inherited=true`)
      .reply(200, []))
    .stdout({ print })
    .stderr({ print })
    .command(['secrets', '-a', 'examples', '--platform', 'my-platform', download_location])
    .it('download platform secrets failed when there are no secrets', ctx => {
      expect(ctx.stdout).to.contain('There are no secrets to download');
    })

  defaults
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(fs, 'writeFileSync', sinon.spy())
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
          secret: 'environment-override'
        },
        '*': {
          'platform-secret': 'platform-secret-val',
          'acc-secret': 'acc-secret-val'
        }
      }

      const fs_spy = fs.writeFileSync as SinonSpy;
      expect(ctx.stdout).to.contain(`Secrets have been downloaded`);
      expect(fs_spy.calledOnce).to.be.true;
      expect(fs_spy.calledWith(download_location, yaml.dump(expected_env_secrets))).to.be.true;
    })
  
  defaults
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(fs, 'writeFileSync', sinon.spy())
    .stdout({ print })
    .stderr({ print })
    .command(['secrets', '-a', 'examples', '-e', 'non-existed-environment-name', download_location])
    .catch(ctx => {
      expect(ctx.message).to.contain('Failed to find secrets. Please ensure your platform or environment exists.')
    })
    .it('download environment secrets failed with non-existed environment');

  defaults
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(fs, 'writeFileSync', sinon.spy())
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
