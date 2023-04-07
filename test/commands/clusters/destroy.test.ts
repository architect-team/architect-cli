import { expect } from 'chai';
import { MockArchitectApi } from '../../utils/mocks';

describe('clusters:destroy', () => {
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

  new MockArchitectApi()
    .getAccount(mock_account)
    .getCluster(mock_account, mock_cluster)
    .getCluster(mock_account, mock_cluster)
    .deleteCluster(mock_cluster, mock_pipeline)
    .pollPipeline(mock_pipeline)
    .getTests()
    .command(['clusters:destroy', '-a', mock_account.name, mock_cluster.name, '--auto-approve'])
    .it('should generate destroy deployment', ctx => {
      expect(ctx.stdout).to.contain('Cluster deregistered\n')
    });

  new MockArchitectApi()
    .getAccount(mock_account)
    .getCluster(mock_account, mock_cluster)
    .getCluster(mock_account, mock_cluster)
    .deleteCluster(mock_cluster, mock_pipeline, { force: 1 })
    .pollPipeline(mock_pipeline)
    .getTests()
    .command(['clusters:destroy', '-a', mock_account.name, mock_cluster.name, '--auto-approve', '--force'])
    .it('should force apply destroy job', ctx => {
      expect(ctx.stdout).to.contain('Cluster deregistered\n')
    });
});
