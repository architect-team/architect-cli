import { expect } from '@oclif/test';
import { MockArchitectApi, mockArchitectAuth, MOCK_APP_HOST } from '../../utils/mocks';

describe('environment:create', () => {
  const mock_account = {
    id: 'test-account-id',
    name: 'test-account',
  };

  const mock_env = {
    id: 'test-env-id',
    name: 'test-env',
  };

  const mock_cluster = {
    id: 'test-cluster-id',
    name: 'test-cluster',
  };

  const mock_url = `${MOCK_APP_HOST}/${mock_account.name}/environments/${mock_env.name}`;

  new MockArchitectApi()
    .getAccountByName(mock_account)
    .getCluster(mock_account, mock_cluster)
    .createEnvironment(mock_account)
    .getApiMocks()
    .command(['environment:create', mock_env.name, '-a', mock_account.name, '--cluster', mock_cluster.name])
    .it('should create an environment with the cluster flag', ctx => {
      expect(ctx.stdout).to.contain(`Environment created: ${mock_url}`);
      expect(ctx.stderr).to.contain('done');
    });

  new MockArchitectApi()
    .getAccountByName(mock_account)
    .getClusters(mock_account, [mock_cluster], { limit: 1 })
    .createEnvironment(mock_account)
    .getApiMocks()
    .command(['environment:create', mock_env.name, '-a', mock_account.name])
    .it('should create an environment without the cluster flag if there is only one cluster', ctx => {
      expect(ctx.stdout).to.contain(`Environment created: ${mock_url}`);
      expect(ctx.stderr).to.contain('done');
    });

  new MockArchitectApi()
    .getAccountByName(mock_account)
    .getClusters(mock_account, [mock_cluster, mock_cluster], { limit: 1 })
    .getApiMocks()
    .command(['environment:create', mock_env.name, '-a', mock_account.name])
    .catch(ctx => {
      expect(ctx.message).to.include('--cluster flag is required')
    })
    .it('should create an environment without the cluster flag should fail in CI if there are multiple clusters');

  new MockArchitectApi()
    .getAccountByName(mock_account)
    .getCluster(mock_account, mock_cluster)
    .createEnvironment(mock_account)
    .getApiMocks()
    .env({ ARCHITECT_CLUSTER: mock_cluster.name })
    .command(['environment:create', mock_env.name, '-a', mock_account.name])
    .it('should create an environment with the cluster environment variable', ctx => {
      expect(ctx.stdout).to.contain(`Using cluster from environment variables: ${mock_cluster.name}`);
      expect(ctx.stdout).to.contain(`Environment created: ${mock_url}`);
    });

  new MockArchitectApi()
    .getAccountByName(mock_account)
    .getCluster(mock_account, mock_cluster)
    .createEnvironment(mock_account, { response_code: 409 })
    .getApiMocks()
    .env({ ARCHITECT_CLUSTER: mock_cluster.name })
    .command(['environment:create', mock_env.name, '-a', mock_account.name, '--strict'])
    .catch(err => {
      expect(err.message).to.contain('Request failed with status code 409');
    })
    .it('should error when an environment name is already in use for an account and --strict is provided');

  new MockArchitectApi()
    .getAccountByName(mock_account)
    .getCluster(mock_account, mock_cluster)
    .createEnvironment(mock_account, { response_code: 409 })
    .getApiMocks()
    .env({ ARCHITECT_CLUSTER: mock_cluster.name })
    .command(['environment:create', mock_env.name, '-a', mock_account.name, '--strict=true'])
    .catch(err => {
      expect(err.message).to.contain('Request failed with status code 409');
    })
    .it('should error when an environment name is already in use for an account and --strict is explicitly set to true');

  new MockArchitectApi()
    .getAccountByName(mock_account)
    .getCluster(mock_account, mock_cluster)
    .createEnvironment(mock_account, { response_code: 409 })
    .getApiMocks()
    .env({ ARCHITECT_CLUSTER: mock_cluster.name })
    .command(['environment:create', mock_env.name, '-a', mock_account.name, '--strict=false'])
    .it('should print warning when an environment name is already in use for an account and --strict is explicitly set to false', ctx => {
      expect(ctx.stderr).to.contain(`Unable to create new environment '${mock_env.name}'.`);
      expect(ctx.stderr).to.contain(`in use for account '${mock_account.name}'`);
    });

  new MockArchitectApi()
    .getAccountByName(mock_account)
    .getCluster(mock_account, mock_cluster)
    .createEnvironment(mock_account, { response_code: 409 })
    .getApiMocks()
    .env({ ARCHITECT_CLUSTER: mock_cluster.name })
    .command(['environment:create', mock_env.name, '-a', mock_account.name])
    .it('should print warning when an environment name is already in use for an account and --strict is not provided', ctx => {
      expect(ctx.stderr).to.contain(`Unable to create new environment '${mock_env.name}'.`);
      expect(ctx.stderr).to.contain(`in use for account '${mock_account.name}'`);
    });

  new MockArchitectApi()
    .getAccountByName(mock_account)
    .getCluster(mock_account, mock_cluster)
    .createEnvironment(mock_account)
    .getApiMocks()
    .command(['environment:create', mock_env.name, '-a', mock_account.name, '--platform', mock_cluster.name])
    .it('should create an environment with the platform flag, but with a deprecation warning', ctx => {
      expect(ctx.stderr).to.contain('Warning: The "platform" flag has been deprecated. Use "cluster" instead.');
      expect(ctx.stdout).to.contain(`Environment created: ${mock_url}`);
    });

  new MockArchitectApi()
    .getAccountByName(mock_account)
    .getCluster(mock_account, mock_cluster)
    .createEnvironment(mock_account)
    .getApiMocks()
    .env({ ARCHITECT_PLATFORM: mock_cluster.name })
    .command(['environment:create', mock_env.name, '-a', mock_account.name])
    .it('should create an environment with the platform environment variable', ctx => {
      expect(ctx.stdout).to.contain(`Using cluster from environment variables: ${mock_cluster.name}`);
      expect(ctx.stdout).to.contain(`Environment created: ${mock_url}`);
    });

  mockArchitectAuth()
    .command(['environment:create', mock_env.name, '-a', mock_account.name, '--cluster', mock_cluster.name, '--platform', mock_cluster.name])
    .catch(err => {
      expect(err.message).to.contain('--cluster=test-cluster cannot also be provided when using --platform');
      expect(err.message).to.contain('--platform=test-cluster cannot also be provided when using --cluster');
    })
    .it(`the --cluster and --platform flags can't be used together`);
});
