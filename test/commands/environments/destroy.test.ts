import { expect, test } from '@oclif/test';
import AccountUtils from '../../../src/architect/account/account.utils';
import { EnvironmentUtils } from '../../../src/architect/environment/environment.utils';
import PipelineUtils from '../../../src/architect/pipeline/pipeline.utils';
import { MOCK_API_HOST } from '../../utils/mocks';

describe('environment:destroy', () => {
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

  const mock_pipeline = {
    id: 'test-pipeline-id',
  };

  const failing_mock_env = {
    id: null,
    name: 'failing-test-env',
  };

  const mock_test_common = test
    .stub(AccountUtils, 'getAccount', () => mock_account)
    .stdout({ print })
    .stderr({ print })
    .timeout(20000);

  const success_mock_test = mock_test_common
    .stub(PipelineUtils, 'pollPipeline', async () => null)
    .stub(EnvironmentUtils, 'getEnvironment', () => mock_env)
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.id}/environments/${mock_env.name}`)
      .reply(201, mock_env));

  const failing_mock_test_strict = mock_test_common
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.id}/environments/${failing_mock_env.name}`)
      .reply(404));

  const failing_mock_test_not_strict = mock_test_common
    .stub(EnvironmentUtils, 'getEnvironment', () => failing_mock_env);

  failing_mock_test_strict
    .command(['environment:destroy', '--auto-approve', '--strict=true', '-a', mock_account.name, failing_mock_env.name])
    .catch(e => {
      expect(e.message).to.contain(`Environment '${failing_mock_env.name}' not found`);
    })
    .it('should exit with error status when --strict is set explicitly to true');

  failing_mock_test_strict
    .command(['environment:destroy', '--auto-approve', '--strict', '-a', mock_account.name, failing_mock_env.name])
    .catch(e => {
      expect(e.message).to.contain(`Environment '${failing_mock_env.name}' not found`);
    })
    .it('should exit with error status when --strict is passed without explicit mapping');

  failing_mock_test_not_strict
    .command(['environment:destroy', '--auto-approve', '--strict=false', '-a', mock_account.name, failing_mock_env.name])
    .it('should warn and exit with non-error status when --strict is set explicitly to false', ctx => {
      expect(ctx.stderr).to.contain(`Warning: No configured environments found matching ${failing_mock_env.name}.`);
    });

  failing_mock_test_not_strict
    .command(['environment:destroy', '--auto-approve', '-a', mock_account.name, failing_mock_env.name])
    .it('should warn and exit with non-error status when --strict is not used', ctx => {
      expect(ctx.stderr).contains(`Warning: No configured environments found matching ${failing_mock_env.name}.`);
    });

  success_mock_test
    .nock(MOCK_API_HOST, api => api
      .delete(`/environments/${mock_env.id}?force=0`)
      .reply(200, mock_pipeline))
    .command(['environment:destroy', '--auto-approve', '-a', mock_account.name, mock_env.name])
    .it('should generate destroy deployment', ctx => {
      expect(ctx.stdout).to.contain('Environment deregistered\n');
    });

  success_mock_test
    .nock(MOCK_API_HOST, api => api
      .delete(`/environments/${mock_env.id}?force=1`)
      .reply(200, mock_pipeline))
    .command(['environment:destroy', '--auto-approve', '--force', '-a', mock_account.name, mock_env.name])
    .it('should force apply destroy job', ctx => {
      expect(ctx.stdout).to.contain('Environment deregistered\n');
    });
});
