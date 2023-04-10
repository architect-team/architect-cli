import { expect } from '@oclif/test';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import sinon, { SinonSpy } from 'sinon';
import untildify from 'untildify';
import UserUtils from '../../../src/architect/user/user.utils';
import { MockArchitectApi } from '../../utils/mocks';

describe('secrets', function () {
  const download_location = path.resolve(untildify('~/secrets.yml'));

  const account = {
    id: "aa440d39-97d9-43c3-9f1a-a9a69adb2a41",
    name: "examples"
  }

  const environment = {
    id: 'ee475441-a499-4646-b553-7ce8dd476e92',
    name: 'env',
    account,
  }

  const cluster = {
    id: '59db4eae-eb8a-4125-8834-7fb7b6208cbd',
    name: 'my-cluster',
    account,
  }

  const account_secrets = [
    {
      scope: 'cloud/*',
      key: 'secret',
      value: 'secret-val',
      account,
    },
    {
      scope: '*',
      key: 'acc-secret',
      value: 'acc-secret-val',
      account,
    }
  ]

  const cluster_secrets_w_inheritance = [
    {
      scope: 'cloud/*',
      key: 'secret',
      value: 'cluster-override',
      cluster,
    },
    {
      scope: '*',
      key: 'cluster-secret',
      value: 'cluster-secret-val',
      cluster,
    },
    {
      scope: '*',
      key: 'acc-secret',
      value: 'acc-secret-val',
      account,
    }
  ]

  const environment_secrets_w_inheritance = [
    {
      scope: 'cloud/*',
      key: 'secret',
      value: 'environment-override',
      environment,
    },
    {
      scope: '*',
      key: 'cluster-secret',
      value: 'cluster-secret-val',
      cluster,
    },
    {
      scope: '*',
      key: 'acc-secret',
      value: 'acc-secret-val',
      account,
    }
  ]

  new MockArchitectApi()
    .getAccount(account)
    .getAccountSecrets(account, account_secrets)
    .getTests()
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(fs, 'writeFileSync', sinon.spy())
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

  new MockArchitectApi()
    .getAccount(account)
    .getCluster(account, cluster)
    .getClusterSecrets(cluster, cluster_secrets_w_inheritance, { inherited: true })
    .getTests()
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(fs, 'writeFileSync', sinon.spy())
    .command(['secrets', '-a', 'examples', '--cluster', 'my-cluster', download_location])
    .it('download cluster secrets successfully', async ctx => {
      const expected_cluster_secrets = {
        'cloud/*': {
          secret: 'cluster-override'
        },
        '*': {
          'cluster-secret': 'cluster-secret-val',
          'acc-secret': 'acc-secret-val'
        }
      }

      const fs_spy = fs.writeFileSync as SinonSpy;
      expect(ctx.stdout).to.contain(`Secrets have been downloaded`);
      expect(fs_spy.calledOnce).to.be.true;
      expect(fs_spy.calledWith(download_location, yaml.dump(expected_cluster_secrets))).to.be.true;
    })

  new MockArchitectApi()
    .getAccount(account)
    .getCluster(account, cluster)
    .getClusterSecrets(cluster, [], { inherited: true })
    .getTests()
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(fs, 'writeFileSync', sinon.spy())
    .command(['secrets', '-a', 'examples', '--cluster', 'my-cluster', download_location])
    .it('download cluster secrets failed when there are no secrets', ctx => {
      expect(ctx.stdout).to.contain('There are no secrets to download');
    })

  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .getEnvironmentSecrets(environment, environment_secrets_w_inheritance, { inherited: true })
    .getTests()
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(fs, 'writeFileSync', sinon.spy())
    .command(['secrets', '-a', 'examples', '-e', 'env', download_location])
    .it('download environment secrets successfully', async ctx => {
      const expected_env_secrets = {
        'cloud/*': {
          secret: 'environment-override'
        },
        '*': {
          'cluster-secret': 'cluster-secret-val',
          'acc-secret': 'acc-secret-val'
        }
      }

      const fs_spy = fs.writeFileSync as SinonSpy;
      expect(ctx.stdout).to.contain(`Secrets have been downloaded`);
      expect(fs_spy.calledOnce).to.be.true;
      expect(fs_spy.calledWith(download_location, yaml.dump(expected_env_secrets))).to.be.true;
    })

  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .getEnvironmentSecrets(environment, [], { inherited: true })
    .getTests()
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(fs, 'writeFileSync', sinon.spy())
    .command(['secrets', '-a', 'examples', '-e', 'env', download_location])
    .it('download environment secrets failed when there are no secrets', ctx => {
      expect(ctx.stdout).to.contain('There are no secrets to download');
    })

  new MockArchitectApi()
    .getAccount(account)
    .getTests()
    .stub(UserUtils, 'isAdmin', async () => false)
    .command(['secrets', '-a', 'examples', download_location])
    .catch(ctx => {
      expect(ctx.message).to.contain('You do not have permission to download secrets')
    })
    .it('download account secrets failed due to permission');

  new MockArchitectApi()
    .getTests()
    .command(['secrets', '-a', 'examples', '--cluster', 'my-cluster', '-e', 'env', download_location])
    .catch(ctx => {
      expect(ctx.message).to.contain('Please provide either the cluster flag or the environment flag and not both.')
    })
    .it('download cluster secrets failed when both cluster and environment flags are set');
});
