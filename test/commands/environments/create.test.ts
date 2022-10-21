import { expect } from '@oclif/test';
import { mockArchitectAuth, MOCK_API_HOST } from '../../utils/mocks';

describe('environment:create', () => {

  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

  const mock_account = {
    id: 'test-account-id',
    name: 'test-account'
  };

  const mock_env = {
    id: 'test-env-id',
    name: 'test-env'
  };

  const mock_cluster = {
    id: 'test-cluster-id',
    name: 'test-cluster'
  };

  const create_environment = mockArchitectAuth()
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.name}`)
      .reply(200, mock_account))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.id}/clusters/${mock_cluster.name}`)
      .reply(200, mock_cluster))
    .nock(MOCK_API_HOST, api => api
      .post(`/accounts/${mock_account.id}/environments`)
      .reply(201))
    .stdout({ print })
    .stderr({ print });

  create_environment
    .command(['environment:create', mock_env.name, '-a', mock_account.name, '--cluster', mock_cluster.name])
    .it('should create an environment with the cluster flag', ctx => {
      expect(ctx.stdout).to.contain('Environment created');
    });

  create_environment
    .env({ ARCHITECT_CLUSTER: mock_cluster.name })
    .command(['environment:create', mock_env.name, '-a', mock_account.name])
    .it('should create an environment with the cluster environment variable', ctx => {
      expect(ctx.stdout).to.contain(`Using cluster from environment variables: ${mock_cluster.name}`);
      expect(ctx.stdout).to.contain('Environment created');
    });

  create_environment
    .command(['environment:create', mock_env.name, '-a', mock_account.name, '--platform', mock_cluster.name])
    .it('should create an environment with the platform flag', ctx => {
      expect(ctx.stdout).to.contain('Environment created');
    });

  create_environment
  .env({ ARCHITECT_PLATFORM: mock_cluster.name })
    .command(['environment:create', mock_env.name, '-a', mock_account.name])
    .it('should create an environment with the platform environment variable', ctx => {
      expect(ctx.stdout).to.contain(`Using cluster from environment variables: ${mock_cluster.name}`);
      expect(ctx.stdout).to.contain('Environment created');
    });

  mockArchitectAuth()
    .command(['environment:create', mock_env.name, '-a', mock_account.name, '--cluster', mock_cluster.name, '--platform', mock_cluster.name])
    .catch(err => {
      expect(err.message).to.contain('--cluster=test-cluster cannot also be provided when using --platform');
      expect(err.message).to.contain('--platform=test-cluster cannot also be provided when using --cluster');
    })
    .it(`the --cluster and --platform flags can't be used together`);
});
