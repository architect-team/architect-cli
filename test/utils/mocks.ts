import { test } from '@oclif/test';
import fs from 'fs-extra';
import { RequestBodyMatcher } from 'nock/types';
import path from 'path';
import { Dictionary, RecursivePartial } from '../../src';
import AuthClient from '../../src/app-config/auth';
import Account from '../../src/architect/account/account.entity';
import Cluster from '../../src/architect/cluster/cluster.entity';
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
  private api_mocks;

  constructor(options?: {
      print?: boolean
  }) {
    this.api_mocks = mockArchitectAuth()
      .stdout({ print: !!options?.print })
      .stderr({ print: !!options?.print });
  }

  getApiMocks() {
    return this.api_mocks;
  }

  // /accounts
  getAccountByName(account: Partial<Account>, options?: { response_code?: number, response?: any }) { // TODO: don't set defaults in functions, use || ?
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}`)
      .reply(options?.response_code || 200, options?.response || account)); // TODO: allow setting reply in other places as a callback or object
    return this;
  }

  // /accounts/<account>/environments
  getEnvironmentByName(account: Partial<Account>, environment: Partial<Environment>, options?: { response_code: number }) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/environments/${environment.name}`)
      .reply(options?.response_code || 200, environment))
    return this;
  }

  createEnvironment(account: Account, options?: { response_code: number }) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .post(`/accounts/${account.id}/environments`)
      .reply(options?.response_code || 201))
    return this;
  }

  // /environments
  getEnvironments(environments?: Partial<Environment>[], options?: { query?: string }) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/environments?q=${options?.query || ''}`)
      .reply(200, { rows: environments || [], total: environments?.length || 0 }));
    return this;
  }

  updateEnvironment(environment: Partial<Environment>, dto: { replicas?: number, clear_scaling?: boolean, resource_slug: string }) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .put(`/environments/${environment.id}`, dto)
      .reply(200));
    return this;
  }

  updateEnvironmentScaling(environment: Partial<Environment>, dto: { replicas: number, resource_slug: string }, options: { response_code?: number } = { response_code: 200 }) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .put(`/environments/${environment.id}/scale`, dto)
      .reply(options.response_code))
    return this;
  }

  // TODO: type? (any)
  deployComponent(environment: Partial<Environment>, pipeline: RecursivePartial<Pipeline>, options?: { callback?: RequestBodyMatcher }) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .post(`/environments/${environment.id}/deploy`, options?.callback || ((body) => body))
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
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/environments/${environment.id}/certificates`)
      .reply(200, certificates))
    return this;
  }

  deleteEnvironmentInstances(environment: Partial<Environment>, pipeline: RecursivePartial<Pipeline>) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .delete(`/environments/${environment.id}/instances`)
      .reply(200, pipeline));
    return this;
  }

  deleteEnvironment(environment: Partial<Environment>, pipeline: RecursivePartial<Pipeline>, options?: { force?: 0 | 1 }) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .delete(`/environments/${environment.id}?force=${options?.force || 0}`)
      .reply(200, pipeline));
    return this;
  }

  // /accounts/<account>/clusters
  getCluster(account: Partial<Account>, cluster: Partial<Cluster>) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/clusters/${cluster.name}`)
      .reply(200, cluster))
    return this;
  }

  getClusters(account: Partial<Account>, clusters: Partial<Cluster>[]) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/clusters?limit=1`)
      .reply(200, { total: clusters.length, rows: clusters }));
    return this;
  }

  // /accounts/<account>/components
  getLatestComponentDigest(account: Partial<Account>, component_version: RecursivePartial<ComponentVersion>) { // TODO: attempt to not use Partial/RecursivePartial
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/components/${component_version.component?.name}`)
      .reply(200, component_version))
    return this;
  }

  getComponentVersionByTag(account: Partial<Account>, component_version: RecursivePartial<ComponentVersion>) { // TODO: add AndAccountId
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/components/${component_version.component?.name}/versions/${component_version.tag}`)
      .reply(200, component_version))
    return this;
  }

  getComponentVersionByTagAndAccountName(account: Partial<Account>, component_version: RecursivePartial<ComponentVersion>) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}/components/${component_version.component?.name}/versions/${component_version.tag}`)
      .reply(200, component_version))
    return this;
  }

  // TODO: better name for first callback and similar ones
  // TODO: find type for reply callback
  // TODO: generalize function arg types based on endpoint requirements
  registerComponentDigest(options?: { callback?: RequestBodyMatcher, reply?: any }) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/, options?.callback || ((body) => body))
      .reply(200, options?.reply || {})
    )
    return this;
  }

  // /pipelines
  approvePipeline(pipeline: RecursivePartial<Pipeline>) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .post(`/pipelines/${pipeline.id}/approve`)
      .reply(200, {}));
    return this;
  }

  getPipelineDeployments(pipeline: RecursivePartial<Pipeline>, deployments: RecursivePartial<Deployment>[]) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/pipelines/${pipeline.id}/deployments`)
      .reply(200, deployments));
    return this;
  }

  // poll pipeline
  pollPipeline(pipeline: RecursivePartial<Pipeline>) {
    this.api_mocks = this.api_mocks.stub(PipelineUtils, 'pollPipeline', async () => pipeline);
    return this;
  } // TODO: does this belong here?

  // Architect registry
  architectRegistryHeadRequest(endpoint: string | RegExp = /.*/) {
    this.api_mocks = this.api_mocks.nock(MOCK_REGISTRY_HOST, api => api
      .persist()
      .head(endpoint)
      .reply(200, '', { 'docker-content-digest': 'some-digest' }),
    );
    return this;
  }


}
