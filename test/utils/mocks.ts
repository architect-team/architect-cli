import { test } from '@oclif/test';
import fs from 'fs-extra';
import path from 'path';
import { RecursivePartial } from '../../src';
import AuthClient from '../../src/app-config/auth';
import Account from '../../src/architect/account/account.entity';
import ComponentVersion from '../../src/architect/component/component-version.entity';
import Environment from '../../src/architect/environment/environment.entity';
import SecretUtils from '../../src/architect/secret/secret.utils';
import { DockerComposeUtils } from '../../src/common/docker-compose';
import DockerBuildXUtils from '../../src/common/docker/buildx.utils';

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

  constructor(options?: {
      print?: boolean
  }) {
    this.test = mockArchitectAuth()
      .stdout({ print: !!options?.print })
      .stderr({ print: !!options?.print });
  }

  getConstructedApiTests() {
    return this.test;
  }

  // /accounts
  getAccountByName(account: Partial<Account>) {
    this.test = this.test.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}`)
      .reply(200, account));
    return this;
  }

  // /accounts/<account>/environments
  getEnvironmentByName(account: Partial<Account>, environment: Partial<Environment>) {
    this.test = this.test.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/environments/${environment.name}`)
      .reply(200, environment))
    return this;
  }

  // /environments
  updateEnvironment(environment: Partial<Environment>, dto: { replicas: number, resource_slug: string }) {
    this.test = this.test.nock(MOCK_API_HOST, api => api
      .put(`/environments/${environment.id}`, dto)
      .reply(200));
    return this;
  }

  updateEnvironmentScaling(environment: Partial<Environment>, dto: { replicas: number, resource_slug: string }, options: { response_code?: number } = { response_code: 200 }) {
    this.test = this.test.nock(MOCK_API_HOST, api => api
      .put(`/environments/${environment.id}/scale`, dto)
      .reply(options.response_code))
    return this;
  }

  // /accounts/<account>/components
  getLatestComponentDigest(account: Partial<Account>, component_version: RecursivePartial<ComponentVersion>) { // TODO: attempt to not use Partial/RecursivePartial
    this.test = this.test.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/components/${component_version.component?.name}`)
      .reply(200, component_version))
    return this;
  }

  getComponentVersionByTag(account: Partial<Account>, component_version: RecursivePartial<ComponentVersion>) {
    this.test = this.test.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/components/${component_version.component?.name}/versions/${component_version.tag}`)
      .reply(200, component_version))
    return this;
  }
}
