import { expect } from '@oclif/test';
import { mockArchitectAuth, MOCK_API_HOST, MOCK_APP_HOST } from '../../utils/mocks';

describe('environment:create', () => {
  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

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

  const create_environment = mockArchitectAuth()
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.name}`)
      .reply(200, mock_account))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.id}/clusters/${mock_cluster.name}`)
      .optionally(true)
      .reply(200, mock_cluster))
    .nock(MOCK_API_HOST, api => api
      .post(`/accounts/${mock_account.id}/environments`)
      .optionally(true)
      .reply(201))
    .stdout({ print })
    .stderr({ print });

  const create_duplicate_environment = mockArchitectAuth()
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.name}`)
      .reply(200, mock_account))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.id}/clusters/${mock_cluster.name}`)
      .reply(200, mock_cluster))
    .nock(MOCK_API_HOST, api => api
      .post(`/accounts/${mock_account.id}/environments`)
      .reply(409))
    .stdout({ print })
    .stderr({ print });

  create_environment
    .command(['environment:create', mock_env.name, '-a', mock_account.name, '--cluster', mock_cluster.name])
    .it('should create an environment with the cluster flag', ctx => {
      expect(ctx.stdout).to.contain(`Environment created: ${mock_url}`);
      expect(ctx.stderr).to.contain('done');
    });

  create_environment
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.id}/clusters?limit=1`)
      .reply(200, { total: 1, rows: [mock_cluster] }))
    .command(['environment:create', mock_env.name, '-a', mock_account.name])
    .it('should create an environment without the cluster flag if there is only one cluster', ctx => {
      expect(ctx.stdout).to.contain(`Environment created: ${mock_url}`);
      expect(ctx.stderr).to.contain('done');
    });

  create_environment
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.id}/clusters?limit=1`)
      .reply(200, { total: 2, rows: [mock_cluster] }))
    .command(['environment:create', mock_env.name, '-a', mock_account.name])
    .catch(ctx => {
      expect(ctx.message).to.include('--cluster flag is required')
    })
    .it('should create an environment without the cluster flag should fail in CI if there are multiple clusters');

  create_environment
    .env({ ARCHITECT_CLUSTER: mock_cluster.name })
    .command(['environment:create', mock_env.name, '-a', mock_account.name])
    .it('should create an environment with the cluster environment variable', ctx => {
      expect(ctx.stdout).to.contain(`Using cluster from environment variables: ${mock_cluster.name}`);
      expect(ctx.stdout).to.contain(`Environment created: ${mock_url}`);
    });

  create_duplicate_environment
    .env({ ARCHITECT_CLUSTER: mock_cluster.name })
    .command(['environment:create', mock_env.name, '-a', mock_account.name, '--strict'])
    .catch(err => {
      expect(err.message).to.contain('Request failed with status code 409');
    })
    .it('should error when an environment name is already in use for an account and --strict is provided');

  create_duplicate_environment
    .env({ ARCHITECT_CLUSTER: mock_cluster.name })
    .command(['environment:create', mock_env.name, '-a', mock_account.name, '--strict=true'])
    .catch(err => {
      expect(err.message).to.contain('Request failed with status code 409');
    })
    .it('should error when an environment name is already in use for an account and --strict is explicitly set to true');

  create_duplicate_environment
    .env({ ARCHITECT_CLUSTER: mock_cluster.name })
    .command(['environment:create', mock_env.name, '-a', mock_account.name, '--strict=false'])
    .it('should print warning when an environment name is already in use for an account and --strict is explicitly set to false', ctx => {
      expect(ctx.stderr).to.contain(`Unable to create new environment '${mock_env.name}'.`);
      expect(ctx.stderr).to.contain(`in use for account '${mock_account.name}'`);
    });

  create_duplicate_environment
    .env({ ARCHITECT_CLUSTER: mock_cluster.name })
    .command(['environment:create', mock_env.name, '-a', mock_account.name])
    .it('should print warning when an environment name is already in use for an account and --strict is not provided', ctx => {
      expect(ctx.stderr).to.contain(`Unable to create new environment '${mock_env.name}'.`);
      expect(ctx.stderr).to.contain(`in use for account '${mock_account.name}'`);
    });

  create_environment
    .command(['environment:create', mock_env.name, '-a', mock_account.name, '--platform', mock_cluster.name])
    .it('should create an environment with the platform flag, but with a deprecation warning', ctx => {
      expect(ctx.stderr).to.contain('Warning: The "platform" flag has been deprecated. Use "cluster" instead.');
      expect(ctx.stdout).to.contain(`Environment created: ${mock_url}`);
    });

  create_environment
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
