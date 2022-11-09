import { expect, test } from '@oclif/test';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import sinon, { SinonSpy } from 'sinon';
import AppService from '../../../src/app-config/service';
import PipelineUtils from '../../../src/architect/pipeline/pipeline.utils';
import ClusterCreate from '../../../src/commands/clusters/create';
import { AgentClusterUtils } from '../../../src/common/utils/agent-cluster.utils';

describe('cluster:create', function () {
  const account = {
    id: 'test-account-id',
    name: 'test-account-name',
  };

  const mock_pipeline = {
    id: 'test-pipeline-id',
  };

  const test_cluster_id = 'test-cluster-id';

  this.afterEach(() => {
    sinon.restore();
  })

  const create_test = () => {
    return test
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
      .nock('https://api.architect.io', api => api
        .get(`/accounts/${account.name}`)
        .reply(200, account))
      .stub(ClusterCreate.prototype, 'postClusterToApi', sinon.stub().returns(Promise.resolve({
        id: test_cluster_id,
        account: account,
        token: {
          access_token: 'token',
        }
      })))
      .stub(ClusterCreate.prototype, 'createClusterApplications', sinon.stub().returns(Promise.resolve()));
  };

  const k8s_test = (install_applications = false) => {
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

  k8s_test()
    .it('Does not auto approve creation when auto-approve flag value is false', async () => {
      const create_cluster_applications = ClusterCreate.prototype.createClusterApplications as SinonSpy;
      const configure_agent = AgentClusterUtils.configureAgentCluster as SinonSpy;
      const post_to_api = ClusterCreate.prototype.postClusterToApi as SinonSpy;

      await ClusterCreate.run(['cluster-name', '-a', 'test-account-name', '--auto-approve=false']);
      expect(configure_agent.calledOnce).true;
      expect(create_cluster_applications.calledOnce).false;
      expect(post_to_api.calledOnce).true;
    });

  k8s_test()
    .it('Auto approve creation when auto-approve flag value is true', async () => {
      const create_cluster_applications = ClusterCreate.prototype.createClusterApplications as SinonSpy;
      const configure_agent = AgentClusterUtils.configureAgentCluster as SinonSpy;
      const post_to_api = ClusterCreate.prototype.postClusterToApi as SinonSpy;

      await ClusterCreate.run(['cluster-name', '-a', 'test-account-name', '--auto-approve=true']);
      expect(configure_agent.calledOnce).true;
      expect(create_cluster_applications.calledOnce).true;
      expect(post_to_api.calledOnce).true;
    });

  k8s_test(true)
    .it('Auto approve creation when auto-approve flag value is not specified', async () => {
      const create_cluster_applications = ClusterCreate.prototype.createClusterApplications as SinonSpy;
      const configure_agent = AgentClusterUtils.configureAgentCluster as SinonSpy;
      const post_to_api = ClusterCreate.prototype.postClusterToApi as SinonSpy;

      await ClusterCreate.run(['cluster-name', '-a', 'test-account-name']);
      expect(configure_agent.calledOnce).true;
      expect(create_cluster_applications.calledOnce).true;
      expect(post_to_api.calledOnce).true;
    });

  k8s_test()
    .it('Do not auto approve creation with auto-approve flag default value', async () => {
      const create_cluster_applications = ClusterCreate.prototype.createClusterApplications as SinonSpy;
      const configure_agent = AgentClusterUtils.configureAgentCluster as SinonSpy;
      const post_to_api = ClusterCreate.prototype.postClusterToApi as SinonSpy;

      await ClusterCreate.run(['cluster-name', '-a', 'test-account-name']);
      expect(configure_agent.calledOnce).true;
      expect(create_cluster_applications.calledOnce).false;
      expect(post_to_api.calledOnce).true;
    });

  create_test()
    .stub(inquirer, 'prompt', () => {
      return {
        context: 'minikube',
        service_account_name: 'architect',
        use_existing_sa: true,
        cluster: 'test-cluster',
        cluster_type: 'agent (BETA)',
        application_install: true,
      }
    })
    .stub(AgentClusterUtils, 'installAgent', sinon.stub().returns(Promise.resolve()))
    .stub(AgentClusterUtils, 'configureAgentCluster', sinon.stub().returns(Promise.resolve()))
    .stub(AgentClusterUtils, 'waitForAgent', sinon.stub().returns(Promise.resolve()))
    .it('configures agent cluster when specified', async () => {
      const create_cluster_applications = ClusterCreate.prototype.createClusterApplications as SinonSpy;
      const install_agent = AgentClusterUtils.installAgent as SinonSpy;
      const configure_agent = AgentClusterUtils.configureAgentCluster as SinonSpy;
      const post_to_api = ClusterCreate.prototype.postClusterToApi as SinonSpy;

      await ClusterCreate.run(['cluster-name', '-a', 'test-account-name']);
      expect(configure_agent.calledOnce).true;
      expect(install_agent.calledOnce).true;
      expect(create_cluster_applications.calledOnce).true;
      expect(post_to_api.calledOnce).true;
    });
});
