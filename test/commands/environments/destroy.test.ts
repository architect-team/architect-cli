import { expect } from 'chai';
import PipelineUtils from '../../../src/architect/pipeline/pipeline.utils';
import { mockArchitectAuth, MOCK_API_HOST } from '../../utils/mocks';

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

  mockArchitectAuth()
    .stub(PipelineUtils, 'pollPipeline', async () => null)
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.name}`)
      .reply(200, mock_account))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.id}/environments/${failing_mock_env.name}`)
      .reply(404))
    .stdout({ print })
    .stderr({ print })
    .timeout(20000)
    .command(['environment:destroy', '-a', mock_account.name, failing_mock_env.name, '--auto-approve', '--strict=true'])
    .catch(e => {
      expect(e.message).to.contain('Request failed with status code 404');
    })
    .it('should exit with error status when --strict is set explicitly to true');

  mockArchitectAuth()
    .stub(PipelineUtils, 'pollPipeline', async () => null)
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.name}`)
      .reply(200, mock_account))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.id}/environments/${failing_mock_env.name}`)
      .reply(200, failing_mock_env))
    .stdout({ print })
    .stderr({ print })
    .timeout(20000)
    .command(['environment:destroy', '-a', mock_account.name, failing_mock_env.name, '--auto-approve', '--strict=false'])
    .it('should warn and exit with non-error status when --strict is set explicitly to false', ctx => {
      expect(ctx.stderr).to.contain(`Warning: No configured environments found matching ${failing_mock_env.name}.`);
    });

  mockArchitectAuth()
    .stub(PipelineUtils, 'pollPipeline', async () => null)
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.name}`)
      .reply(200, mock_account))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.id}/environments/${failing_mock_env.name}`)
      .reply(404))
    .stdout({ print })
    .stderr({ print })
    .timeout(20000)
    .command(['environment:destroy', '-a', mock_account.name, failing_mock_env.name, '--auto-approve', '--strict'])
    .catch(e => {
      expect(e.message).to.contain('Request failed with status code 404');
    })
    .it('should exit with error status when --strict is passed without explicit mapping');

  mockArchitectAuth()
    .stub(PipelineUtils, 'pollPipeline', async () => null)
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.name}`)
      .reply(200, mock_account))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.id}/environments/${failing_mock_env.name}`)
      .reply(200, failing_mock_env))
    .stdout({ print })
    .stderr({ print })
    .timeout(20000)
    .command(['environment:destroy', '-a', mock_account.name, failing_mock_env.name, '--auto-approve'])
    .it('should warn and exit with non-error status when --strict is not used', ctx => {
      expect(ctx.stderr).contains(`Warning: No configured environments found matching ${failing_mock_env.name}.`);
    });

  mockArchitectAuth()
    .stub(PipelineUtils, 'pollPipeline', async () => null)
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.name}`)
      .reply(200, mock_account))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.id}/environments/${mock_env.name}`)
      .times(2)
      .reply(200, mock_env))
    .nock(MOCK_API_HOST, api => api
      .delete(`/environments/${mock_env.id}?force=0`)
      .reply(200, mock_pipeline))
    .stdout({ print })
    .stderr({ print })
    .timeout(20000)
    .command(['environment:destroy', '-a', mock_account.name, mock_env.name, '--auto-approve'])
    .it('should generate destroy deployment', ctx => {
      expect(ctx.stdout).to.contain('Environment deregistered\n');
    });

  mockArchitectAuth()
    .stub(PipelineUtils, 'pollPipeline', async () => null)
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.name}`)
      .reply(200, mock_account))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.id}/environments/${mock_env.name}`)
      .times(2)
      .reply(200, mock_env))
    .nock(MOCK_API_HOST, api => api
      .delete(`/environments/${mock_env.id}?force=1`)
      .reply(200, mock_pipeline))
    .stdout({ print })
    .stderr({ print })
    .timeout(20000)
    .command(['environment:destroy', '-a', mock_account.name, mock_env.name, '--auto-approve', '--force'])
    .it('should force apply destroy job', ctx => {
      expect(ctx.stdout).to.contain('Environment deregistered\n');
    });
});
