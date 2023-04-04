import { expect } from '@oclif/test';
import { ComponentVersionSlugUtils, ResourceSlugUtils } from '../../src';
import { MockArchitectApi, mockArchitectAuth, MOCK_API_HOST } from '../utils/mocks';

// set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
const print = false;

const account = {
  id: 'test-account-id',
  name: 'test-account'
}

const environment = {
  id: 'test-env-id',
  name: 'test-env',
  account,
}

const component_version = {
  tag: '0.0.1',
  component: {
    name: 'echo',
    id: '1234-5678'
  },
  config: {
    services: {
      app: {},
      api: {},
      db: {}
    },
  }
};

const service_to_scale = 'app';
const replicas = 5;
const resource_slug = ResourceSlugUtils.build(component_version.component.name, 'services', service_to_scale);
const dto = { replicas, resource_slug, };
const clear_dto = { resource_slug, clear_scaling: true };

describe('Scale', function () {
  describe('Scale services without deploying', function () {

    new MockArchitectApi()
      .getAccountByName(account)
      .getLatestComponentDigest(account, component_version)
      .getEnvironmentByName(account, environment)
      .updateEnvironmentScaling(environment, dto)
      .updateEnvironment(environment, dto)
      .getConstructedApiTests()
      .command(['scale', service_to_scale, '-e', environment.name, '-a', account.name, '--component', `${component_version.component.name}`, '--replicas', replicas.toString()])
      .it('Sets scaling for service and updates immediately', ctx => {
        expect(ctx.stdout).to.contain(`Scaled service ${service_to_scale} of component ${account.name}/${component_version.component.name} deployed to environment ${environment.name} to ${replicas} replicas`);
        expect(ctx.stdout).to.contain(`Updated scaling settings for service app of component ${component_version.component.name} for environment ${environment.name}`);
      });

    new MockArchitectApi()
      .getAccountByName(account)
      .getLatestComponentDigest(account, component_version)
      .getEnvironmentByName(account, environment)
      .updateEnvironmentScaling(environment, dto, { response_code: 404 })
      .updateEnvironment(environment, dto)
      .getConstructedApiTests()
      .command(['scale', service_to_scale, '-e', environment.name, '-a', account.name, '--component', `${component_version.component.name}`, '--replicas', replicas.toString()])
      .it('Sets scaling for service even if the update cannot take place immediately', ctx => {
        expect(ctx.stdout).to.contain(`Did not immediately scale service ${service_to_scale} of component ${account.name}/${component_version.component.name}.`);
        expect(ctx.stdout).to.contain(`Updated scaling settings for service app of component ${component_version.component.name} for environment ${environment.name}`);
      });

    new MockArchitectApi()
      .getAccountByName(account)
      .getLatestComponentDigest(account, component_version)
      .getConstructedApiTests()
      .command(['scale', 'unknown', '-e', environment.name, '-a', account.name, '--component', `${component_version.component.name}`, '--replicas', replicas.toString()])
      .catch(err => {
        const component_version_slug = ComponentVersionSlugUtils.build(component_version.component.name, 'latest');
        expect(err.message).to.equal(`Component version ${component_version_slug} does not have a service named unknown.`);
      })
      .it(`Fails to set scaling for a service that isn't part of the component`);

    new MockArchitectApi()
      .getAccountByName(account)
      .getComponentVersionByTag(account, component_version)
      .getEnvironmentByName(account, environment)
      .updateEnvironmentScaling(environment, dto)
      .updateEnvironment(environment, dto)
      .getConstructedApiTests()
      .command(['scale', service_to_scale, '-e', environment.name, '-a', account.name, '--component', `${component_version.component.name}`, '--replicas', replicas.toString(), '--tag', component_version.tag])
      .it('Sets scaling for a service by pulling a component with a specific tag', ctx => {
        expect(ctx.stdout).to.contain(`Scaled service ${service_to_scale} of component ${account.name}/${component_version.component.name} deployed to environment ${environment.name} to ${replicas} replicas`);
        expect(ctx.stdout).to.contain(`Updated scaling settings for service app of component ${component_version.component.name} for environment ${environment.name}`);
      });

    mockArchitectAuth()
      .nock(MOCK_API_HOST, api => api
        .get(`/accounts/${account.name}`)
        .reply(200, account))
      .stdout({ print })
      .stderr({ print })
      .nock(MOCK_API_HOST, api => api
        .get(`/accounts/${account.id}/components/${component_version.component.name}`)
        .reply(200, component_version))
      .nock(MOCK_API_HOST, api => api
        .get(`/accounts/${account.id}/environments/${environment.name}`)
        .reply(200, environment))
      .nock(MOCK_API_HOST, api => api
        .put(`/environments/${environment.id}`, clear_dto)
        .reply(200))
      .command(['scale', service_to_scale, '-e', environment.name, '-a', account.name, '--component', `${component_version.component.name}`, '--clear'])
      .it('Unsets scaling settings for service', ctx => {
        expect(ctx.stdout).not.to.contain(`Scaled service ${service_to_scale} of component ${account.name}/${component_version.component.name} deployed to environment ${environment.name} to ${replicas} replicas`);
        expect(ctx.stdout).to.contain(`Updated scaling settings for service app of component ${component_version.component.name} for environment ${environment.name}`);
      });
  });
});
