import { expect } from '@oclif/test';
import AccountUtils from '../../../src/architect/account/account.utils';
import { EnvironmentUtils } from '../../../src/architect/environment/environment.utils';
import PipelineUtils from '../../../src/architect/pipeline/pipeline.utils';
import { MockArchitectApi } from '../../utils/mocks';

describe('environment:destroy', () => {
  const mock_account = {
    id: 'test-account-id',
    name: 'test-account',
  };

  const mock_env = {
    id: 'test-env-id',
    name: 'test-env',
  };

  const mock_pipeline = {
    id: 'test-pipeline-id',
    environment: mock_env
  };

  const failing_mock_env = {
    name: 'failing-test-env',
  };

  new MockArchitectApi()
    .getEnvironmentByName(mock_account, failing_mock_env, { response_code: 404 })
    .getApiMocks()
    .stub(AccountUtils, 'getAccount', () => mock_account)
    .command(['environment:destroy', '--auto-approve', '--strict=true', '-a', mock_account.name, failing_mock_env.name])
    .catch(e => {
      expect(e.message).to.contain(`Environment '${failing_mock_env.name}' not found`);
    })
    .it('should exit with error status when --strict is set explicitly to true');

  new MockArchitectApi()
    .getEnvironmentByName(mock_account, failing_mock_env, { response_code: 404 })
    .getApiMocks()
    .stub(AccountUtils, 'getAccount', () => mock_account)
    .command(['environment:destroy', '--auto-approve', '--strict', '-a', mock_account.name, failing_mock_env.name])
    .catch(e => {
      expect(e.message).to.contain(`Environment '${failing_mock_env.name}' not found`);
    })
    .it('should exit with error status when --strict is passed without explicit mapping');

  new MockArchitectApi()
    .getApiMocks()
    .stub(AccountUtils, 'getAccount', () => mock_account)
    .stub(EnvironmentUtils, 'getEnvironment', () => failing_mock_env)
    .command(['environment:destroy', '--auto-approve', '--strict=false', '-a', mock_account.name, failing_mock_env.name])
    .it('should warn and exit with non-error status when --strict is set explicitly to false', ctx => {
      expect(ctx.stderr).to.contain(`Warning: No configured environments found matching ${failing_mock_env.name}.`);
    });

  new MockArchitectApi()
    .getApiMocks()
    .stub(AccountUtils, 'getAccount', () => mock_account)
    .stub(EnvironmentUtils, 'getEnvironment', () => failing_mock_env)
    .command(['environment:destroy', '--auto-approve', '-a', mock_account.name, failing_mock_env.name])
    .it('should warn and exit with non-error status when --strict is not used', ctx => {
      expect(ctx.stderr).contains(`Warning: No configured environments found matching ${failing_mock_env.name}.`);
    });

  new MockArchitectApi()
    .getEnvironmentByName(mock_account, mock_env)
    .deleteEnvironment(mock_env, mock_pipeline, { force: 0 })
    .getApiMocks()
    .stub(AccountUtils, 'getAccount', () => mock_account)
    .stub(PipelineUtils, 'pollPipeline', async () => null)
    .stub(EnvironmentUtils, 'getEnvironment', () => mock_env)
    .command(['environment:destroy', '--auto-approve', '-a', mock_account.name, mock_env.name])
    .it('should generate destroy deployment', ctx => {
      expect(ctx.stdout).to.contain('Environment deregistered\n');
    });

  new MockArchitectApi()
    .getEnvironmentByName(mock_account, mock_env)
    .deleteEnvironment(mock_env, mock_pipeline, { force: 1 })
    .getApiMocks()
    .stub(AccountUtils, 'getAccount', () => mock_account)
    .stub(PipelineUtils, 'pollPipeline', async () => null)
    .stub(EnvironmentUtils, 'getEnvironment', () => mock_env)
    .command(['environment:destroy', '--auto-approve', '--force', '-a', mock_account.name, mock_env.name])
    .it('should force apply destroy job', ctx => {
      expect(ctx.stdout).to.contain('Environment deregistered\n');
    });
});
