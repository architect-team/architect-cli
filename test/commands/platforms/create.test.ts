import { expect } from '@oclif/test';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import nock from 'nock';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import AppConfig from '../../../src/app-config/config';
import AppService from '../../../src/app-config/service';
import PipelineUtils from '../../../src/architect/pipeline/pipeline.utils';
import PlatformCreate from '../../../src/commands/platforms/create';
import { KubernetesPlatformUtils } from '../../../src/common/utils/kubernetes-platform.utils';
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

    const mock_pipeline = {
      id: 'test-pipeline-id'
    }
    sinon.replace(PipelineUtils, 'pollPipeline', async () => mock_pipeline);

    // Stub the log_level
    const config = new AppConfig('', {
      log_level: 'debug',
    });
    const tmp_config_file = path.join(tmp_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);
    const app_config_stub = sinon.stub().returns(new AppService(tmp_dir, '0.0.1'));
    sinon.replace(AppService, 'create', app_config_stub);
  });

  it('Creates a Kubernetes platform with input', async () => {
    const inquirerStub = sinon.stub(inquirer, 'prompt');
    inquirerStub.resolves({
      context: 'minikube',
      service_account_name: 'architect',
      use_existing_sa: true,
      application_install: true,
    });

    const test_platform_id = 'test-platform-id';
    const test_pipeline_id = 'test-pipeline-id';

    nock('https://api.architect.io').get(`/accounts/${account.name}`)
      .reply(200, account);

    nock('https://api.architect.io').post(`/accounts/${account.id}/platforms`)
      .reply(200, {
        id: test_platform_id,
        account: account
      });

    nock('https://api.architect.io').post(`/platforms/${test_platform_id}/apps`)
      .reply(200, {
        id: 'test-deployment-id',
        pipeline: {
          id: test_pipeline_id,
        },
      });

    const create_platform_applications_spy = sinon.spy(PlatformCreate.prototype, 'createPlatformApplications');
    const create_platform_spy = sinon.spy(PlatformCreate.prototype, 'createArchitectPlatform');
    const post_to_api_spy = sinon.spy(PlatformCreate.prototype, 'postPlatformToApi');
    const kubernetes_configuration_fake = sinon.fake.returns({ name: 'new_k8s_platform', type: 'KUBERNETES' });
    sinon.replace(KubernetesPlatformUtils, 'configureKubernetesPlatform', kubernetes_configuration_fake);

    await PlatformCreate.run(['platform-name', '-a', 'test-account-name', '-t', 'kubernetes']);
    expect(create_platform_spy.calledOnce).true;
    expect(post_to_api_spy.calledOnce).true;
    expect(kubernetes_configuration_fake.calledOnce).true;
    expect(create_platform_applications_spy.calledOnce).true;
  });
});
