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
import CredentialManager from '../../../src/app-config/credentials';
import AppService from '../../../src/app-config/service';
import PlatformCreate from '../../../src/commands/platforms/create';
import { KubernetesPlatformUtils } from '../../../src/common/utils/kubernetes-platform.utils';
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

    sinon.replace(PortUtil, 'isPortAvailable', async () => true);
    PortUtil.reset();

    const credential_spy = sinon.fake.returns('token');
    sinon.replace(CredentialManager.prototype, 'get', credential_spy);

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

  it('Creates a new public platform when name arg is included', async () => {
    moxios.stubRequest(`/accounts/${account.name}`, {
      status: 200,
      response: account
    });

    moxios.stubRequest(`/accounts/${account.id}/platforms/public`, {
      status: 200,
      response: {
        id: 'test-platform-id',
        account: account
      }
    });

    const create_platform_spy = sinon.fake.returns({});
    sinon.replace(PlatformCreate.prototype, 'create_architect_platform', create_platform_spy);
    const post_to_api_spy = sinon.spy(PlatformCreate.prototype, 'post_platform_to_api');

    await PlatformCreate.run(['platform-name', '-a', 'test-account-name', '-t', 'architect']);
    expect(create_platform_spy.calledOnce).true;
    expect(post_to_api_spy.calledOnce).true;
  });

  it('Creates a new public platform when name arg is not included', async () => {
    const inquirerStub = sinon.stub(inquirer, 'prompt');
    inquirerStub.resolves({
      platform: 'platform-name'
    });

    moxios.stubRequest(`/accounts/${account.name}`, {
      status: 200,
      response: account
    });

    moxios.stubRequest(`/accounts/${account.id}/platforms/public`, {
      status: 200,
      response: {
        id: 'test-platform-id',
        account: account
      }
    });

    const create_platform_spy = sinon.fake.returns({});
    sinon.replace(PlatformCreate.prototype, 'create_architect_platform', create_platform_spy);
    const post_to_api_spy = sinon.spy(PlatformCreate.prototype, 'post_platform_to_api');

    await PlatformCreate.run(['-a', 'test-account-name', '-t', 'architect']);
    expect(create_platform_spy.calledOnce).true;
    expect(post_to_api_spy.calledOnce).true;
  });

  it('Creates an ECS platform with input', async () => {
    moxios.stubRequest(`/accounts/${account.name}`, {
      status: 200,
      response: account
    });

    moxios.stubRequest(`/accounts/${account.id}/platforms`, {
      status: 200,
      response: {
        id: 'test-platform-id',
        account: account
      }
    });

    const create_platform_spy = sinon.spy(PlatformCreate.prototype, 'create_architect_platform');
    const post_to_api_spy = sinon.spy(PlatformCreate.prototype, 'post_platform_to_api');

    await PlatformCreate.run(['platform-name', '-a', 'test-account-name', '-t', 'ecs', '--aws_region', 'us-east-2', '--aws_secret', 'test-secret', '--aws_key', 'test-key']);
    expect(create_platform_spy.calledOnce).true;
    expect(post_to_api_spy.calledOnce).true;
  });

  it('Creates an ECS platform without flag input', async () => {
    const inquirerStub = sinon.stub(inquirer, 'prompt');
    inquirerStub.resolves({
      aws_region: 'us-east-2',
      aws_secret: 'test-secret',
      aws_key: 'test-key'
    });

    moxios.stubRequest(`/accounts/${account.name}`, {
      status: 200,
      response: account
    });

    moxios.stubRequest(`/accounts/${account.id}/platforms`, {
      status: 200,
      response: {
        id: 'test-platform-id',
        account: account
      }
    });

    const create_platform_spy = sinon.spy(PlatformCreate.prototype, 'create_architect_platform');
    const post_to_api_spy = sinon.spy(PlatformCreate.prototype, 'post_platform_to_api');

    await PlatformCreate.run(['platform-name', '-a', 'test-account-name', '-t', 'ecs']);
    expect(create_platform_spy.calledOnce).true;
    expect(post_to_api_spy.calledOnce).true;
  });

  it('Creates a Kubernetes platform with input', async () => {
    const inquirerStub = sinon.stub(inquirer, 'prompt');
    inquirerStub.resolves({
      context: 'minikube',
      service_account_name: 'architect',
      use_existing_sa: true,
    });

    moxios.stubRequest(`/accounts/${account.name}`, {
      status: 200,
      response: account
    });

    moxios.stubRequest(`/accounts/${account.id}/platforms`, {
      status: 200,
      response: {
        id: 'test-platform-id',
        account: account
      }
    });

    const create_platform_spy = sinon.spy(PlatformCreate.prototype, 'create_architect_platform');
    const post_to_api_spy = sinon.spy(PlatformCreate.prototype, 'post_platform_to_api');
    const kubernetes_configuration_fake = sinon.fake.returns({ name: 'new_k8s_platform', type: 'KUBERNETES' });
    sinon.replace(KubernetesPlatformUtils, 'configure_kubernetes_platform', kubernetes_configuration_fake);

    await PlatformCreate.run(['platform-name', '-a', 'test-account-name', '-t', 'kubernetes']);
    expect(create_platform_spy.calledOnce).true;
    expect(post_to_api_spy.calledOnce).true;
    expect(kubernetes_configuration_fake.calledOnce).true;
  });
});
