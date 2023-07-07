import { test } from '@oclif/test';
import fs from 'fs-extra';
import { ReplyBody, RequestBodyMatcher } from 'nock/types';
import path from 'path';
import { RecursivePartial } from '../../src';
import AuthClient from '../../src/app-config/auth';
import Account from '../../src/architect/account/account.entity';
import Cluster from '../../src/architect/cluster/cluster.entity';
import { ComponentVersion } from '../../src/architect/component/component-version.entity';
import { Component } from '../../src/architect/component/component.entity';
import Deployment from '../../src/architect/deployment/deployment.entity';
import Environment from '../../src/architect/environment/environment.entity';
import { ParsedCertificate, Replica, ScaleServiceDto, UpdateEnvironmentDto } from '../../src/architect/environment/environment.utils';
import Pipeline from '../../src/architect/pipeline/pipeline.entity';
import PipelineUtils from '../../src/architect/pipeline/pipeline.utils';
import { AccountSecret, ClusterSecret, EnvironmentSecret } from '../../src/architect/secret/secret.utils';
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
    .stub(DockerBuildXUtils, 'convertToBuildxPlatforms', () => { });

interface TestOptions {
  times?: number;
  body?: RequestBodyMatcher;
  response?: ReplyBody | Promise<ReplyBody>;
  response_code?: number;
};

// https://github.com/nock/nock/blob/2edf34116a986ad4776b1ca97235504e5b9206b4/types/index.d.ts#L171
export type ReplyCallback = (err: NodeJS.ErrnoException | null, result: ReplyBody) => void;

export class MockArchitectApi {
  private api_mocks;

  constructor(options?: {
    print?: boolean,
    timeout?: number,
  }) {
    this.api_mocks = mockArchitectAuth()
      .stdout({ print: !!options?.print })
      .stderr({ print: !!options?.print })
      .timeout(options?.timeout);
  }

  getTests() {
    return this.api_mocks;
  }

  // /accounts/<account>
  getAccount(account: Partial<Account>, options?: TestOptions) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}`)
      .times(options?.times || 1)
      .reply(options?.response_code || 200, options?.response || account));
    return this;
  }

  getAccountSecrets(account: Partial<Account>, secrets: AccountSecret[]) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/secrets/values`)
      .reply(200, secrets));
    return this;
  }

  // /accounts/<account>/environments
  getEnvironment(account: Partial<Account>, environment: RecursivePartial<Environment>, options?: TestOptions) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/environments/${environment.name}`)
      .reply(options?.response_code || 200, options?.response || environment))
    return this;
  }

  createEnvironment(account: Account, options?: { response_code: number }) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .post(`/accounts/${account.id}/environments`)
      .reply(options?.response_code || 201))
    return this;
  }

  // /environments/<environment>
  getEnvironments(environments?: Partial<Environment>[], options?: { query?: string }) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/environments?q=${options?.query || ''}`)
      .reply(200, { rows: environments || [], total: environments?.length || 0 }));
    return this;
  }

  updateEnvironment(environment: Partial<Environment>, dto: UpdateEnvironmentDto) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .put(`/environments/${environment.id}`, dto as RequestBodyMatcher)
      .reply(200));
    return this;
  }

  updateEnvironmentScaling(environment: Partial<Environment>, dto: ScaleServiceDto, options?: TestOptions) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .put(`/environments/${environment.id}/scale`, dto as RequestBodyMatcher)
      .reply(options?.response_code || 200))
    return this;
  }

  deployComponent(environment: Partial<Environment>, pipeline: RecursivePartial<Pipeline>, options?: TestOptions) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .post(`/environments/${environment.id}/deploy`, options?.body)
      .reply(200, pipeline))
    return this;
  }

  getEnvironmentCertificates(environment: Partial<Environment>, certificates: RecursivePartial<ParsedCertificate>[]) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/environments/${environment.id}/certificates`)
      .reply(200, certificates));
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
      .delete(`/environments/${environment.id}?force=${options?.force}`)
      .reply(200, pipeline));
    return this;
  }

  environmentExec(environment: RecursivePartial<Environment>, task_id: string, options?: TestOptions) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .post(`/environments/${environment.id}/exec`, options?.body)
      .reply(options?.response_code || 200, options?.response || task_id)
    );
    return this;
  }

  getEnvironmentReplicas(environment: Partial<Environment>, replicas: Replica[], component?: Partial<Component>) {
    const query = component ? `?component_name=${component.name}` : '';
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/environments/${environment.id}/replicas${query}`)
      .reply(200, replicas))
    return this;
  }

  getEnvironmentSecrets(environment: Partial<Environment>, secrets: (Partial<EnvironmentSecret> | Partial<ClusterSecret> | Partial<AccountSecret>)[], options?: { inherited?: boolean }) {
    const query = options?.inherited ? `?inherited=${options.inherited}` : '';
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/environments/${environment.id}/secrets/values${query}`)
      .reply(200, secrets));
    return this;
  }

  // /accounts/<account>/clusters
  getCluster(account: Partial<Account>, cluster: Partial<Cluster>) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/clusters/${cluster.name}`)
      .reply(200, cluster))
    return this;
  }

  getClusters(account: Partial<Account>, clusters: Partial<Cluster>[], options?: { limit?: number }) {
    const query = options?.limit ? `?limit=${options.limit}` : '';
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/clusters${query}`)
      .reply(200, { total: clusters.length, rows: clusters }));
    return this;
  }

  // /clusters/<cluster>
  deleteCluster(cluster: Partial<Cluster>, pipeline: Partial<Pipeline>, options?: { force?: 0 | 1 }) {
    const query = options?.force ? `?force=${options.force}` : '';
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .delete(`/clusters/${cluster.id}${query}`)
      .reply(200, pipeline))
    return this;
  }

  getClusterSecrets(cluster: Partial<Cluster>, secrets: (Partial<ClusterSecret> | Partial<AccountSecret>)[], options?: { inherited?: boolean }) {
    const query = options?.inherited ? `?inherited=${options.inherited}` : '';
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/clusters/${cluster.id}/secrets/values${query}`)
      .reply(200, secrets));
    return this;
  }

  // /components
  getComponents(components: RecursivePartial<Component>[], options?: { query?: string }) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/components?q=${options?.query || ''}`)
      .reply(200, { rows: components, count: components.length }));
    return this;
  }

  // /components/<component>
  getComponentVersions(component: RecursivePartial<Component>, component_versions: Partial<ComponentVersion>[]) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/components/${component.component_id}/versions`)
      .reply(200, { rows: component_versions, count: component_versions.length }));
    return this;
  }

  // /accounts/<account>/components
  getLatestComponentDigest(account: Partial<Account>, component_version: RecursivePartial<ComponentVersion>) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/components/${component_version.component?.name}`)
      .reply(200, component_version))
    return this;
  }

  getComponentVersionByTagAndAccountId(account: Partial<Account>, component_version: RecursivePartial<ComponentVersion>) {
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

  registerComponentDigest(account: Partial<Account>, options?: TestOptions) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .post(`/accounts/${account.id}/components`, options?.body)
      .times(options?.times || 1)
      .reply(200, options?.response || {})
    )
    return this;
  }

  getComponent(account: Partial<Account>, component: RecursivePartial<Component>) {
    this.api_mocks = this.api_mocks.nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}/components/${component.name}`)
      .reply(200, component));
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
  }

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
