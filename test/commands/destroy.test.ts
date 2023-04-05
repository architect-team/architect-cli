import { expect } from 'chai';
import PipelineUtils from '../../src/architect/pipeline/pipeline.utils';
import { MockArchitectApi } from '../utils/mocks';

describe('destroy', function () {
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

  new MockArchitectApi()
    .getAccountByName(mock_account)
    .getEnvironmentByName(mock_account, mock_env)
    .deleteEnvironmentInstances(mock_env, mock_pipeline)
    .approvePipeline(mock_pipeline)
    .pollPipeline(mock_pipeline)
    .getConstructedApiTests()
    .stub(PipelineUtils, 'pollPipeline', async () => mock_pipeline)
    .command(['destroy', '-a', mock_account.name, '-e', mock_env.name, '--auto-approve'])
    .it('destroy completes', ctx => {
      expect(ctx.stdout).to.contain('Deployed\n');
    });

  new MockArchitectApi()
    .getAccountByName(mock_account)
    .getEnvironmentByName(mock_account, mock_env)
    .deleteEnvironmentInstances(mock_env, mock_pipeline)
    .approvePipeline(mock_pipeline)
    .pollPipeline(mock_pipeline)
    .getConstructedApiTests()
    .command(['destroy', '-a', mock_account.name, '-e', mock_env.name, '--auto_approve'])
    .it('destroy completes with a warning when using a deprecated flag', ctx => {
      expect(ctx.stderr).to.contain('Warning: The "auto_approve" flag has been deprecated.');
      expect(ctx.stdout).to.contain('Deployed\n');
    });
});
