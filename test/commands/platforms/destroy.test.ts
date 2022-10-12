import { expect } from 'chai';
import PipelineUtils from '../../../src/architect/pipeline/pipeline.utils';
import { mockArchitectAuth, MOCK_API_HOST } from '../../utils/mocks';

describe('environment:destroy', () => {

  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

  const mock_account = {
    id: 'test-account-id',
    name: 'test-account'
  }

  const mock_cluster = {
    id: 'test-cluster-id',
    name: 'test-cluster'
  }

  const mock_pipeline = {
    id: 'test-pipeline-id'
  }

  mockArchitectAuth
    .stub(PipelineUtils, 'pollPipeline', async () => null)
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.name}`)
      .reply(200, mock_account))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.id}/clusters/${mock_cluster.name}`)
      .times(2)
      .reply(200, mock_cluster))
    .nock(MOCK_API_HOST, api => api
      .delete(`/clusters/${mock_cluster.id}`)
      .reply(200, mock_pipeline))
    .stdout({ print })
    .stderr({ print })
    .timeout(20000)
    .command(['platforms:destroy', '-a', mock_account.name, mock_cluster.name, '--auto-approve'])
    .it('should generate destroy deployment', ctx => {
      expect(ctx.stdout).to.contain('Cluster deregistered\n')
    });

  mockArchitectAuth
    .stub(PipelineUtils, 'pollPipeline', async () => null)
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.name}`)
      .reply(200, mock_account))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.id}/clusters/${mock_cluster.name}`)
      .times(2)
      .reply(200, mock_cluster))
    .nock(MOCK_API_HOST, api => api
      .delete(`/clusters/${mock_cluster.id}?force=1`)
      .reply(200, mock_pipeline))
    .stdout({ print })
    .stderr({ print })
    .timeout(20000)
    .command(['platforms:destroy', '-a', mock_account.name, mock_cluster.name, '--auto-approve', '--force'])
    .it('should force apply destroy job', ctx => {
      expect(ctx.stdout).to.contain('Cluster deregistered\n')
    });

});
