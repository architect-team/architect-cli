import { test } from '@oclif/test';
import fs from 'fs-extra';
import path from 'path';
import AuthClient from '../../src/app-config/auth';
import Account from '../../src/architect/account/account.entity';
import ComponentVersion from '../../src/architect/component/component-version.entity';
import Environment from '../../src/architect/environment/environment.entity';
import SecretUtils from '../../src/architect/secret/secret.utils';
import { DockerComposeUtils } from '../../src/common/docker-compose';
import DockerBuildXUtils from '../../src/common/docker/buildx.utils';
import { DeepPartial } from '../../src/common/utils/types';

export const MOCK_API_HOST = 'http://mock.api.localhost';
export const MOCK_APP_HOST = 'http://mock.app.localhost';
export const MOCK_REGISTRY_HOST = 'http://mock.registry.localhost';

export const TMP_DIR = path.join(__dirname, '../tmp');
export const EXAMPLE_PROJECT_PATHS =
  fs
    .readdirSync('test/mocks/examples', { withFileTypes: true })
    .filter(f => f.isFile)
    // eslint-disable-next-line unicorn/no-array-reduce
    .reduce((accumulator, current_file) => {
      return accumulator.set(current_file.name, path.join(__dirname, '../', 'mocks', 'examples', current_file.name));
    }, new Map<string, string>());

export const getMockComponentFilePath = (project_name: string): string => {
  let config_path = '';
  if (project_name && project_name.length > 0) {
    config_path = EXAMPLE_PROJECT_PATHS.get(`${project_name}.architect.yml`) || '';
  }
  if (!config_path || config_path.length === 0) {
    throw new Error(`unable to find example mock project ${project_name}.architect.yml`);
  }
  return config_path;
};

export const getMockComponentContextPath = (project_name: string): string => {
  if (!EXAMPLE_PROJECT_PATHS.has(`${project_name}.architect.yml`)) {
    throw new Error(`unable to find example mock architect.yml ${project_name}`);
  }
  return path.join(__dirname, '../', 'integration/hello-world');
};

export const mockArchitectAuth = () =>
  test
    .stub(AuthClient.prototype, 'init', () => { })
    .stub(AuthClient.prototype, 'loginFromCli', () => { })
    .stub(AuthClient.prototype, 'generateBrowserUrl', () => {
      return 'http://mockurl.com';
    })
    .stub(AuthClient.prototype, 'loginFromBrowser', () => { })
    .stub(AuthClient.prototype, 'logout', () => { })
    .stub(AuthClient.prototype, 'dockerLogin', () => { })
    .stub(AuthClient.prototype, 'getToken', () => {
      return {
        account: 'test-user',
        password: 'test-password',
      };
    })
    .stub(AuthClient.prototype, 'refreshToken', () => { })
    .stub(DockerComposeUtils, 'dockerCompose', () => { })
    .stub(DockerComposeUtils, 'writeCompose', () => { })
    .stub(DockerBuildXUtils, 'writeBuildkitdConfigFile', () => { })
    .stub(DockerBuildXUtils, 'dockerBuildX', () => { })
    .stub(DockerBuildXUtils, 'getBuilder', () => { })
    .stub(SecretUtils, 'getSecrets', () => [])
    .stub(SecretUtils, 'batchUpdateSecrets', () => [])
    .stub(DockerBuildXUtils, 'convertToBuildxPlatforms', () => { });

export class MockArchitectApi {
  test;
  environment?: Partial<Environment>;
  account?: Partial<Account>;
  component_version?: DeepPartial<ComponentVersion>;

  constructor(options: {
      account?: Partial<Account>,
      environment?: Partial<Environment>,
      component_version?: DeepPartial<ComponentVersion>,
      print?: boolean
  }) {
    this.test = mockArchitectAuth()
      .stdout({ print: !!options.print })
      .stderr({ print: !!options.print });

    if (options.environment) {
      this.environment = options.environment;
    }
    if (options.account) {
      this.account = options.account;
    }
    if (options.component_version) {
      this.component_version = options.component_version;
    }
  }

  getConstructedApiTests() {
    return this.test;
  }

  // /accounts
  getAccountByName() {
    this.test = this.test.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${this.account?.name}`)
      .reply(200, this.account));
    return this;
  }

  // /accounts/<account>/environments
  getEnvironmentByName() {
    this.test = this.test.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${this.account?.id}/environments/${this.environment?.name}`)
      .reply(200, this.environment))
    return this;
  }

  // /environments
  updateEnvironment(dto: { replicas: number, resource_slug: string }) {
    this.test = this.test.nock(MOCK_API_HOST, api => api
      .put(`/environments/${this.environment?.id}`, dto)
      .reply(200));
    return this;
  }

  updateEnvironmentScaling(dto: { replicas: number, resource_slug: string }) {
    this.test = this.test.nock(MOCK_API_HOST, api => api
      .put(`/environments/${this.environment?.id}/scale`, dto)
      .reply(200))
    return this;
  }

  // /accounts/<account>/components
  getComponentVersionByName() {
    this.test = this.test.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${this.account?.id}/components/${this.component_version?.component?.name}`)
      .reply(200, this.component_version))
    return this;
  }
}
