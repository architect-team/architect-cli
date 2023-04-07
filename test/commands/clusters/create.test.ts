import { expect } from '@oclif/test';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import sinon, { SinonSpy } from 'sinon';
import AppService from '../../../src/app-config/service';
import ClusterUtils, { MIN_CLUSTER_SEMVER } from '../../../src/architect/cluster/cluster.utils';
import PipelineUtils from '../../../src/architect/pipeline/pipeline.utils';
import ClusterCreate from '../../../src/commands/clusters/create';
import { AgentClusterUtils } from '../../../src/common/utils/agent-cluster.utils';
import { MockArchitectApi } from '../../utils/mocks';

describe('cluster:create', function () {
  const account = {
    id: 'test-account-id',
    name: 'test-account-name',
  };

  const clusters = [{
    name: 'already-exists-cluster'
  }];

  const mock_pipeline = {
    id: 'test-pipeline-id',
  };

  const test_cluster_id = 'test-cluster-id';

  this.afterEach(() => {
    sinon.restore();
  })

  const create_test = () => {
    return new MockArchitectApi({ mock_api_host: 'https://api.architect.io' }) // TODO: see about updating the host here
      .getAccount(account)
      .getClusters(account, clusters)
      .getTests()
      .stub(ClusterUtils, 'getServerVersion', sinon.stub().returns(MIN_CLUSTER_SEMVER.version))
      .stub(ClusterCreate.prototype, 'log', sinon.stub())
      .stub(PipelineUtils, 'pollPipeline', async () => mock_pipeline)
      .stub(fs, 'readJSONSync', () => {
        return {
          log_level: 'debug',
        };
      })
      .stub(AppService, 'create', () => new AppService('', '1.0.0'))
      .stub(ClusterCreate.prototype, <any>'setupKubeContext', async () => {
        return {
          original_context: "original_context",
          current_context: "current_context",
        }
      })
      .stub(ClusterCreate.prototype, <any>'setContext', async () => { })
      .stub(ClusterCreate.prototype, 'postClusterToApi', sinon.stub().returns(Promise.resolve({
        id: test_cluster_id,
        account: account,
        token: {
          access_token: 'token',
        }
      })))
      .stub(ClusterCreate.prototype, 'createClusterApplications', sinon.stub().returns(Promise.resolve()));
  };

  const agent_test = (install_applications = false) => {
    return create_test()
      .stub(AgentClusterUtils, 'installAgent', sinon.stub().returns(Promise.resolve()))
      .stub(AgentClusterUtils, 'waitForAgent', sinon.stub().returns(Promise.resolve()))
      .stub(AgentClusterUtils, 'configureAgentCluster', sinon.stub().returns(Promise.resolve({ name: 'new_k8s_cluster', type: 'AGENT' })))
      .stub(inquirer, 'prompt', () => {
        return {
          context: 'minikube',
          service_account_name: 'architect',
          use_existing_sa: true,
          cluster: 'test-cluster',
          application_install: install_applications,
        }
      });
  }

  agent_test()
    .it('Does not auto approve creation when auto-approve flag value is false', async () => {
      const create_cluster_applications = ClusterCreate.prototype.createClusterApplications as SinonSpy;
      const configure_agent = AgentClusterUtils.configureAgentCluster as SinonSpy;
      const post_to_api = ClusterCreate.prototype.postClusterToApi as SinonSpy;

      await ClusterCreate.run(['cluster-name', '-a', 'test-account-name', '--auto-approve=false']);
      expect(configure_agent.calledOnce).true;
      expect(create_cluster_applications.calledOnce).false;
      expect(post_to_api.calledOnce).true;
    });

  agent_test()
    .it('Auto approve creation when auto-approve flag value is true', async () => {
      const create_cluster_applications = ClusterCreate.prototype.createClusterApplications as SinonSpy;
      const configure_agent = AgentClusterUtils.configureAgentCluster as SinonSpy;
      const post_to_api = ClusterCreate.prototype.postClusterToApi as SinonSpy;

      await ClusterCreate.run(['cluster-name', '-a', 'test-account-name', '--auto-approve=true']);
      expect(configure_agent.calledOnce).true;
      expect(create_cluster_applications.calledOnce).true;
      expect(post_to_api.calledOnce).true;
    });

  agent_test(true)
    .it('Auto approve creation when auto-approve flag value is not specified', async () => {
      const create_cluster_applications = ClusterCreate.prototype.createClusterApplications as SinonSpy;
      const configure_agent = AgentClusterUtils.configureAgentCluster as SinonSpy;
      const post_to_api = ClusterCreate.prototype.postClusterToApi as SinonSpy;

      await ClusterCreate.run(['cluster-name', '-a', 'test-account-name']);
      expect(configure_agent.calledOnce).true;
      expect(create_cluster_applications.calledOnce).true;
      expect(post_to_api.calledOnce).true;
    });

  agent_test()
    .it('Do not auto approve creation with auto-approve flag default value', async () => {
      const create_cluster_applications = ClusterCreate.prototype.createClusterApplications as SinonSpy;
      const configure_agent = AgentClusterUtils.configureAgentCluster as SinonSpy;
      const post_to_api = ClusterCreate.prototype.postClusterToApi as SinonSpy;

      await ClusterCreate.run(['cluster-name', '-a', 'test-account-name']);
      expect(configure_agent.calledOnce).true;
      expect(create_cluster_applications.calledOnce).false;
      expect(post_to_api.calledOnce).true;
    });

  agent_test()
    .it('Do not allow a user to create a cluster with a duplicate name', async () => {
      const create_cluster_applications = ClusterCreate.prototype.createClusterApplications as SinonSpy;
      const configure_agent = AgentClusterUtils.configureAgentCluster as SinonSpy;
      const post_to_api = ClusterCreate.prototype.postClusterToApi as SinonSpy;

      await ClusterCreate.run(['already-exists-cluster', '-a', 'test-account-name']);
      expect(configure_agent.calledOnce).true;
      expect(create_cluster_applications.calledOnce).false;
      expect(post_to_api.calledOnce).true;
      expect(post_to_api.getCall(0).args[0].name === 'new_k8s_cluster');
    })

  new MockArchitectApi({ mock_api_host: 'https://api.architect.io' }) // TODO: see about updating the host here
    .getAccount(account)
    .getClusters(account, clusters)
    .getTests()
    .stub(ClusterUtils, 'getServerVersion', sinon.stub().returns('v1.0.0'))
    .stub(ClusterCreate.prototype, 'log', sinon.stub())
    .stub(PipelineUtils, 'pollPipeline', async () => mock_pipeline)
    .stub(fs, 'readJSONSync', () => {
      return {
        log_level: 'debug',
      };
    })
    .stub(AppService, 'create', () => new AppService('', '1.0.0'))
    .stub(ClusterCreate.prototype, <any>'setupKubeContext', async () => {
      return {
        original_context: "original_context",
        current_context: "current_context",
      }
    })
    .stub(ClusterCreate.prototype, <any>'setContext', async () => { })
    .command(['cluster:create', '-a', account.name, 'my-cluster'])
    .catch(e => {
      expect(e.message).contains(`Currently, we only support Kubernetes clusters on version ${MIN_CLUSTER_SEMVER.version} or greater. Your cluster is currently on version 1.0.0`);
    })
    .it('create cluster with older cluster version fails');
});
