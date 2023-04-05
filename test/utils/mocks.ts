import { test } from '@oclif/test';
import fs from 'fs-extra';
import { RequestBodyMatcher } from 'nock/types';
import path from 'path';
import { Dictionary, RecursivePartial } from '../../src';
import AuthClient from '../../src/app-config/auth';
import Account from '../../src/architect/account/account.entity';
import ComponentVersion from '../../src/architect/component/component-version.entity';
import Deployment from '../../src/architect/deployment/deployment.entity';
import Environment from '../../src/architect/environment/environment.entity';
import Pipeline from '../../src/architect/pipeline/pipeline.entity';
import PipelineUtils from '../../src/architect/pipeline/pipeline.utils';
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

// TODO: instead of "mocks not yet satisfied" when a mocked api call is missing, can we include a better error by modifying the test object?
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
  updateEnvironment(environment: Partial<Environment>, dto: { replicas?: number, clear_scaling?: boolean, resource_slug: string }) {
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

  // TODO: type? (any)
  deployComponent(environment: Partial<Environment>, pipeline: RecursivePartial<Pipeline>, options: { callback?: RequestBodyMatcher } = { callback: (body: any) => body }) {
    this.test = this.test.nock(MOCK_API_HOST, api => api
      .post(`/environments/${environment.id}/deploy`, options.callback)
      .reply(200, pipeline))
    return this;
  }

  getEnvironmentCertificates(environment: Partial<Environment>, certificates: { // TODO: type
      metadata: {
        labels: Dictionary<string>;
      },
      spec: {
        dnsNames: string[];
      },
    }[]) {
    this.test = this.test.nock(MOCK_API_HOST, api => api
      .get(`/environments/${environment.id}/certificates`)
      .reply(200, certificates))
    return this;
  }

  deleteEnvironmentInstances(environment: Partial<Environment>, pipeline: RecursivePartial<Pipeline>) {
    this.test = this.test.nock(MOCK_API_HOST, api => api
      .delete(`/environments/${environment.id}/instances`)
      .reply(200, pipeline));
    return this;
  }

  // /accounts/<account>/components
  getLatestComponentDigest(account: Partial<Account>, component_version: RecursivePartial<ComponentVersion>) { // TODO: attempt to not use Partial/RecursivePartial
    this.test = this.test.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/components/${component_version.component?.name}`)
      .reply(200, component_version))
    return this;
  }

  getComponentVersionByTag(account: Partial<Account>, component_version: RecursivePartial<ComponentVersion>) { // TODO: add AndAccountId
    this.test = this.test.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/components/${component_version.component?.name}/versions/${component_version.tag}`)
      .reply(200, component_version))
    return this;
  }

  getComponentVersionByTagAndAccountName(account: Partial<Account>, component_version: RecursivePartial<ComponentVersion>) {
    this.test = this.test.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}/components/${component_version.component?.name}/versions/${component_version.tag}`)
      .reply(200, component_version))
    return this;
  }

  // TODO: better name for first callback and similar ones
  // TODO: find type for reply callback
  // TODO: generalize function arg types based on endpoint requirements
  registerComponentDigest(options: { callback?: RequestBodyMatcher, reply_callback?: any } = { callback: (body: any) => body, reply_callback: (reply: any) => {} }) {
    this.test = this.test.nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/, options.callback)
      .reply(200, options.reply_callback)
    )
    return this;
  }

  // /pipelines
  approvePipeline(pipeline: RecursivePartial<Pipeline>) {
    this.test = this.test.nock(MOCK_API_HOST, api => api
      .post(`/pipelines/${pipeline.id}/approve`)
      .reply(200, {}));
    return this;
  }

  getPipelineDeployments(pipeline: RecursivePartial<Pipeline>, deployments: RecursivePartial<Deployment>[]) {
    this.test = this.test.nock(MOCK_API_HOST, api => api
      .get(`/pipelines/${pipeline.id}/deployments`)
      .reply(200, deployments));
    return this;
  }

  // poll pipeline
  pollPipeline(pipeline: RecursivePartial<Pipeline>) {
    this.test = this.test.stub(PipelineUtils, 'pollPipeline', async () => pipeline);
    return this;
  }

  // Architect registry
  architectRegistryHeadRequest(endpoint: string | RegExp = /.*/) {
    this.test = this.test.nock(MOCK_REGISTRY_HOST, api => api
      .persist()
      .head(endpoint)
      .reply(200, '', { 'docker-content-digest': 'some-digest' }),
    );
    return this;
  }


}
