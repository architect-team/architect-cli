import { expect } from '@oclif/test';
import sinon from 'sinon';
import { ComponentVersionSlugUtils, ResourceSlugUtils } from '../../src';
import Scale from '../../src/commands/scale';
import { mockArchitectAuth, MOCK_API_HOST } from '../utils/mocks';

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
    component_id: '1234-5678'
  },
  config: {
    services: {
      app: {},
      api: {},
      db: {}
    },
  }
};

const component_version_name = ComponentVersionSlugUtils.build(account.name, component_version.component.name, component_version.tag);
const service_to_scale = 'app';
const replicas = 5;
const dto = { replicas, resource_slug: ResourceSlugUtils.build(undefined, component_version.component.name, 'services', service_to_scale) };

describe('Scale', function () {
  describe('Scale services without deploying', function () {
    const scale = mockArchitectAuth
      .stub(Scale.prototype, 'getCreatePipelineConfirmation', sinon.stub().returns(Promise.resolve(false)))
      .nock(MOCK_API_HOST, api => api
        .get(`/accounts/${account.name}`)
        .reply(200, account))
      .nock(MOCK_API_HOST, api => api
        .get(`/accounts/${account.id}/environments/${environment.name}`)
        .reply(200, environment))
      .nock(MOCK_API_HOST, api => api
        .get(`/accounts/${account.name}/components/${component_version.component.name}`)
        .reply(200, component_version.component))
      .nock(MOCK_API_HOST, api => api
        .get(`/components/${component_version.component.component_id}/versions/${component_version.tag}`)
        .reply(200, component_version))
      .stdout({ print })
      .stderr({ print })

    scale
      .nock(MOCK_API_HOST, api => api
        .put(`/environments/${environment.id}/scale`, dto)
        .reply(200))
      .nock(MOCK_API_HOST, api => api
        .put(`/environments/${environment.id}`, dto)
        .reply(200))
      .command(['scale', '-e', environment.name, '-a', account.name, `${component_version_name}`, '--service', service_to_scale, '--replicas', replicas.toString()])
      .it('Sets scaling for service when env exists with env and account flags and updates immediately', ctx => {
        expect(ctx.stdout).to.contain(`Scaled service ${service_to_scale} of component ${account.name}/${component_version.component.name} deployed to environment ${environment.name} to ${replicas} replicas`);
        expect(ctx.stdout).to.contain(`Updated scaling settings for service app of component ${component_version.component.name} for environment ${environment.name}`);
      });

    scale
      .nock(MOCK_API_HOST, api => api
        .put(`/environments/${environment.id}/scale`, dto)
        .reply(404))
      .nock(MOCK_API_HOST, api => api
        .put(`/environments/${environment.id}`, dto)
        .reply(200))
      .command(['scale', '-e', environment.name, '-a', account.name, `${component_version_name}`, '--service', service_to_scale, '--replicas', replicas.toString()])
      .it('Sets scaling for service when env exists with env and account flags even if the update cannot take place immediately', ctx => {
        expect(ctx.stdout).to.contain(`Did not immediately scale service ${service_to_scale} of component ${account.name}/${component_version.component.name}.`);
        expect(ctx.stdout).to.contain(`Updated scaling settings for service app of component ${component_version.component.name} for environment ${environment.name}`);
      });

    scale
      .command(['scale', '-e', environment.name, '-a', account.name, `${component_version_name}`, '--service', 'unknown', '--replicas', replicas.toString()])
      .catch(err => {
        expect(err.message).to.equal(`Component version ${component_version_name} does not have a service called unknown.`);
      })
      .it(`Fails to set scaling for a service that isn't part of the component`);
  });
});
