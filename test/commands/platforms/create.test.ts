import { expect } from '@oclif/test';
import fs from 'fs-extra';
import inquirer from 'inquirer';
// import yaml from 'js-yaml';
// import mock_fs from 'mock-fs';
import moxios from 'moxios';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import AppConfig from '../../../src/app-config/config';
import AppService from '../../../src/app-config/service';
import PlatformCreate from '../../../src/commands/platforms/create';
import { KubernetesPlatformUtils } from '../../../src/common/utils/kubernetes-platform.utils';
import { PipelineUtils } from '../../../src/common/utils/pipeline';
import PortUtil from '../../../src/common/utils/port';
import ARCHITECTPATHS from '../../../src/paths';

describe('platform:create', function () {
  let tmp_dir = os.tmpdir();

  const account = {
    id: 'test-account-id',
    name: 'test-account-name'
  }

  beforeEach(() => {
    // Stub the logger
    sinon.replace(PlatformCreate.prototype, 'log', sinon.stub());
    moxios.install();

    moxios.wait(function () {
      let request = moxios.requests.mostRecent()
      if (request) {
        request.respondWith({
          status: 404,
        })
      }
    })

    sinon.replace(PipelineUtils, 'pollPipeline', async () => null);
    sinon.replace(PortUtil, 'isPortAvailable', async () => true);
    PortUtil.reset();

    // Stub the log_level
    const config = new AppConfig('', {
      log_level: 'debug',
    });
    const tmp_config_file = path.join(tmp_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);
    const app_config_stub = sinon.stub().resolves(new AppService(tmp_dir, '0.0.1'));
    sinon.replace(AppService, 'create', app_config_stub);
  });

  afterEach(() => {
    moxios.uninstall();
    sinon.restore();
    // mock_fs.restore();
  });

  it('Creates an ECS platform with input', async () => {
    const test_platform_id = 'test-platform-id';
    const test_pipeline_id = 'test-pipeline-id';

    moxios.stubRequest(`/accounts/${account.name}`, {
      status: 200,
      response: account
    });

    moxios.stubRequest(`/accounts/${account.id}/platforms`, {
      status: 200,
      response: {
        id: test_platform_id,
        account: account
      }
    });

    moxios.stubRequest(`/platforms/${test_platform_id}/apps`, {
      status: 200,
      response: {
        id: 'test-deployment-id',
        pipeline: {
          id: test_pipeline_id,
        },
      }
    });

    const create_platform_applications_spy = sinon.spy(PlatformCreate.prototype, 'createPlatformApplications');
    const create_platform_spy = sinon.spy(PlatformCreate.prototype, 'createArchitectPlatform');
    const post_to_api_spy = sinon.spy(PlatformCreate.prototype, 'postPlatformToApi');

    await PlatformCreate.run(['platform-name', '-a', 'test-account-name', '-t', 'ecs', '--aws-region', 'us-east-2', '--aws-secret', 'test-secret', '--aws-key', 'test-key', '--auto-approve']);
    expect(create_platform_spy.calledOnce).true;
    expect(post_to_api_spy.calledOnce).true;
    expect(create_platform_applications_spy.calledOnce).true;
  });

  it('Creates an ECS platform with input (w/ deprecated flags)', async () => {
    const test_platform_id = 'test-platform-id';
    const test_pipeline_id = 'test-pipeline-id';

    moxios.stubRequest(`/accounts/${account.name}`, {
      status: 200,
      response: account
    });

    moxios.stubRequest(`/accounts/${account.id}/platforms`, {
      status: 200,
      response: {
        id: test_platform_id,
        account: account
      }
    });

    moxios.stubRequest(`/platforms/${test_platform_id}/apps`, {
      status: 200,
      response: {
        id: 'test-deployment-id',
        pipeline: {
          id: test_pipeline_id,
        },
      }
    });

    const create_platform_applications_spy = sinon.spy(PlatformCreate.prototype, 'createPlatformApplications');
    const create_platform_spy = sinon.spy(PlatformCreate.prototype, 'createArchitectPlatform');
    const post_to_api_spy = sinon.spy(PlatformCreate.prototype, 'postPlatformToApi');

    await PlatformCreate.run(['platform-name', '-a', 'test-account-name', '-t', 'ecs', '--aws-region', 'us-east-2', '--aws-secret', 'test-secret', '--aws-key', 'test-key', '--auto-approve']);
    expect(create_platform_spy.calledOnce).true;
    expect(post_to_api_spy.calledOnce).true;
    expect(create_platform_applications_spy.calledOnce).true;
  });

  it('Creates an ECS platform without flag input', async () => {
    const inquirerStub = sinon.stub(inquirer, 'prompt');
    inquirerStub.resolves({
      'aws-region': 'us-east-2',
      'aws-secret': 'test-secret',
      'aws-key': 'test-key'
    });

    const test_platform_id = 'test-platform-id';
    const test_pipeline_id = 'test-pipeline-id';

    moxios.stubRequest(`/accounts/${account.name}`, {
      status: 200,
      response: account
    });

    moxios.stubRequest(`/accounts/${account.id}/platforms`, {
      status: 200,
      response: {
        id: test_platform_id,
        account: account
      }
    });

    moxios.stubRequest(`/platforms/${test_platform_id}/apps`, {
      status: 200,
      response: {
        id: 'test-deployment-id',
        pipeline: {
          id: test_pipeline_id,
        },
      }
    });

    const create_platform_applications_spy = sinon.spy(PlatformCreate.prototype, 'createPlatformApplications');
    const create_platform_spy = sinon.spy(PlatformCreate.prototype, 'createArchitectPlatform');
    const post_to_api_spy = sinon.spy(PlatformCreate.prototype, 'postPlatformToApi');

    await PlatformCreate.run(['platform-name', '-a', 'test-account-name', '-t', 'ecs', '--auto-approve']);
    expect(create_platform_spy.calledOnce).true;
    expect(post_to_api_spy.calledOnce).true;
    expect(create_platform_applications_spy.calledOnce).true;
  });

  it('Creates a Kubernetes platform with input', async () => {
    const inquirerStub = sinon.stub(inquirer, 'prompt');
    inquirerStub.resolves({
      context: 'minikube',
      service_account_name: 'architect',
      use_existing_sa: true,
    });

    const test_platform_id = 'test-platform-id';
    const test_pipeline_id = 'test-pipeline-id';

    moxios.stubRequest(`/accounts/${account.name}`, {
      status: 200,
      response: account
    });

    moxios.stubRequest(`/accounts/${account.id}/platforms`, {
      status: 200,
      response: {
        id: test_platform_id,
        account: account
      }
    });

    moxios.stubRequest(`/platforms/${test_platform_id}/apps`, {
      status: 200,
      response: {
        id: 'test-deployment-id',
        pipeline: {
          id: test_pipeline_id,
        },
      }
    });

    const create_platform_applications_spy = sinon.spy(PlatformCreate.prototype, 'createPlatformApplications');
    const create_platform_spy = sinon.spy(PlatformCreate.prototype, 'createArchitectPlatform');
    const post_to_api_spy = sinon.spy(PlatformCreate.prototype, 'postPlatformToApi');
    const kubernetes_configuration_fake = sinon.fake.returns({ name: 'new_k8s_platform', type: 'KUBERNETES' });
    sinon.replace(KubernetesPlatformUtils, 'configureKubernetesPlatform', kubernetes_configuration_fake);

    await PlatformCreate.run(['platform-name', '-a', 'test-account-name', '-t', 'kubernetes', '--auto-approve']);
    expect(create_platform_spy.calledOnce).true;
    expect(post_to_api_spy.calledOnce).true;
    expect(kubernetes_configuration_fake.calledOnce).true;
    expect(create_platform_applications_spy.calledOnce).true;
  });
});
