import { expect, test } from '@oclif/test';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import sinon, { SinonSpy } from 'sinon';
import AppService from '../../../src/app-config/service';
import PipelineUtils from '../../../src/architect/pipeline/pipeline.utils';
import PlatformCreate from '../../../src/commands/platforms/create';
import { AgentPlatformUtils } from '../../../src/common/utils/agent-platform.utils';
import { KubernetesPlatformUtils } from '../../../src/common/utils/kubernetes-platform.utils';

describe('platform:create', function () {
  const account = {
    id: 'test-account-id',
    name: 'test-account-name',
  };

  const mock_pipeline = {
    id: 'test-pipeline-id',
  };

  const test_platform_id = 'test-platform-id';

  this.afterEach(() => {
    sinon.restore();
  })

  const create_test = () => {
    return test
      .stub(PlatformCreate.prototype, 'log', sinon.stub())
      .stub(PipelineUtils, 'pollPipeline', async () => mock_pipeline)
      .stub(fs, 'readJSONSync', () => {
        return {
          log_level: 'debug',
        };
      })
      .stub(AppService, 'create', () => new AppService('', '1.0.0'))
      .stub(PlatformCreate.prototype, <any>'setupKubeContext', async () => {
        return {
          original_context: "original_context",
          current_context: "current_context",
        }
      })
      .stub(PlatformCreate.prototype, <any>'setContext', async () => { })
      .nock('https://api.architect.io', api => api
        .get(`/accounts/${account.name}`)
        .reply(200, account))
      .stub(PlatformCreate.prototype, 'postPlatformToApi', sinon.stub().returns(Promise.resolve({
        id: test_platform_id,
        account: account,
        token: {
          access_token: 'token',
        }
      })))
      .stub(PlatformCreate.prototype, 'createPlatformApplications', sinon.stub().returns(Promise.resolve()));
  };

  const k8s_test = (install_applications = false) => {
    return create_test()
      .stub(KubernetesPlatformUtils, 'configureKubernetesPlatform', sinon.stub().returns(Promise.resolve({ name: 'new_k8s_platform', type: 'KUBERNETES' })))
      .stub(inquirer, 'prompt', () => {
        return {
          context: 'minikube',
          service_account_name: 'architect',
          use_existing_sa: true,
          platform: 'test-platform',
          application_install: install_applications,
        }
      });
  }

  k8s_test()
    .it('Does not auto approve creation when auto-approve flag value is false', async () => {
      const create_platform_applications = PlatformCreate.prototype.createPlatformApplications as SinonSpy;
      const configure_kubernetes = KubernetesPlatformUtils.configureKubernetesPlatform as SinonSpy;
      const post_to_api = PlatformCreate.prototype.postPlatformToApi as SinonSpy;

      await PlatformCreate.run(['platform-name', '-a', 'test-account-name', '-t', 'kubernetes', '--auto-approve=false']);
      expect(configure_kubernetes.calledOnce).true;
      expect(create_platform_applications.calledOnce).false;
      expect(post_to_api.calledOnce).true;
    });

  k8s_test()
    .it('Auto approve creation when auto-approve flag value is true', async () => {
      const create_platform_applications = PlatformCreate.prototype.createPlatformApplications as SinonSpy;
      const configure_kubernetes = KubernetesPlatformUtils.configureKubernetesPlatform as SinonSpy;
      const post_to_api = PlatformCreate.prototype.postPlatformToApi as SinonSpy;

      await PlatformCreate.run(['platform-name', '-a', 'test-account-name', '-t', 'kubernetes', '--auto-approve=true']);
      expect(configure_kubernetes.calledOnce).true;
      expect(create_platform_applications.calledOnce).true;
      expect(post_to_api.calledOnce).true;
    });

  k8s_test(true)
    .it('Auto approve creation when auto-approve flag value is not specified', async () => {
      const create_platform_applications = PlatformCreate.prototype.createPlatformApplications as SinonSpy;
      const configure_kubernetes = KubernetesPlatformUtils.configureKubernetesPlatform as SinonSpy;
      const post_to_api = PlatformCreate.prototype.postPlatformToApi as SinonSpy;

      await PlatformCreate.run(['platform-name', '-a', 'test-account-name', '-t', 'kubernetes']);
      expect(configure_kubernetes.calledOnce).true;
      expect(create_platform_applications.calledOnce).true;
      expect(post_to_api.calledOnce).true;
    });

  k8s_test()
    .it('Do not auto approve creation with auto-approve flag default value', async () => {
      const create_platform_applications = PlatformCreate.prototype.createPlatformApplications as SinonSpy;
      const configure_kubernetes = KubernetesPlatformUtils.configureKubernetesPlatform as SinonSpy;
      const post_to_api = PlatformCreate.prototype.postPlatformToApi as SinonSpy;

      await PlatformCreate.run(['platform-name', '-a', 'test-account-name', '-t', 'kubernetes']);
      expect(configure_kubernetes.calledOnce).true;
      expect(create_platform_applications.calledOnce).false;
      expect(post_to_api.calledOnce).true;
    });

  create_test()
    .stub(inquirer, 'prompt', () => {
      return {
        context: 'minikube',
        service_account_name: 'architect',
        use_existing_sa: true,
        platform: 'test-platform',
        platform_type: 'agent (BETA)',
        application_install: true,
      }
    })
    .stub(AgentPlatformUtils, 'installAgent', sinon.stub().returns(Promise.resolve()))
    .stub(AgentPlatformUtils, 'configureAgentPlatform', sinon.stub().returns(Promise.resolve()))
    .stub(AgentPlatformUtils, 'waitForAgent', sinon.stub().returns(Promise.resolve()))
    .it('configures agent platform when specified', async () => {
      const create_platform_applications = PlatformCreate.prototype.createPlatformApplications as SinonSpy;
      const install_agent = AgentPlatformUtils.installAgent as SinonSpy;
      const configure_agent = AgentPlatformUtils.configureAgentPlatform as SinonSpy;
      const post_to_api = PlatformCreate.prototype.postPlatformToApi as SinonSpy;

      await PlatformCreate.run(['platform-name', '-a', 'test-account-name']);
      expect(configure_agent.calledOnce).true;
      expect(install_agent.calledOnce).true;
      expect(create_platform_applications.calledOnce).true;
      expect(post_to_api.calledOnce).true;
    });
});
