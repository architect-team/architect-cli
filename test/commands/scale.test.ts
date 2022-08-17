import { expect } from '@oclif/test';
import sinon, { SinonSpy } from 'sinon';
import { ComponentVersionSlugUtils } from '../../src';
import PipelineUtils from '../../src/architect/pipeline/pipeline.utils';
import Deploy from '../../src/commands/deploy';
import * as Docker from '../../src/common/utils/docker';
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

const instance_component_version = {
  tag: '0.0.2',
  component: {
    name: 'echo-instance',
    component_id: '5678-1234'
  },
  config: {
    services: {
      app: {},
      api: {},
      db: {}
    },
    metadata: {
      instance_name: 'instance-name'
    }
  }
}

const mock_pipeline = {
  id: 'test-pipeline-id',
  environment,
}

const component_version_name = ComponentVersionSlugUtils.build(account.name, component_version.component.name, component_version.tag);
const component_version_instance_name = ComponentVersionSlugUtils.build(account.name, instance_component_version.component.name, instance_component_version.tag, instance_component_version.config.metadata.instance_name);

describe('Scaling', function () {
  describe('Scale services without deploying', function () {
    const scale = mockArchitectAuth
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

    const service_to_scale = 'app';
    const scaling_settings = {
      replicas: 5,
      min: 1,
      max: 10,
    };

    const replica_scaling_settings: any = { // TODO: type ScalingSettings?
      scaling_settings: {},
    };
    replica_scaling_settings.scaling_settings[component_version_name] = {};
    replica_scaling_settings.scaling_settings[component_version_name][service_to_scale] = {};
    replica_scaling_settings.scaling_settings[component_version_name][service_to_scale] = { replicas: scaling_settings.replicas };

    scale
      .nock(MOCK_API_HOST, api => api
        .put(`/environments/${environment.id}`, replica_scaling_settings)
        .reply(200))
      .command(['scale', '-e', environment.name, '-a', account.name, `${component_version_name}`, '--service', service_to_scale, '--replicas', scaling_settings.replicas.toString()])
      .it('Sets scaling for service when env exists with env and account flags', ctx => {
        expect(ctx.stdout).to.contain(`Updated scaling settings for service app of component ${component_version.component.name} in environment ${environment.name}`);
      });

    const all_scaling_settings: any = { // TODO: type ScalingSettings?
      scaling_settings: {},
    };
    all_scaling_settings.scaling_settings[component_version_name] = {};
    all_scaling_settings.scaling_settings[component_version_name][service_to_scale] = {};
    all_scaling_settings.scaling_settings[component_version_name][service_to_scale] = scaling_settings;

    scale
      .nock(MOCK_API_HOST, api => api
        .put(`/environments/${environment.id}`, all_scaling_settings)
        .reply(200))
      .command(['scale', '-e', environment.name, '-a', account.name, `${component_version_name}`, '--service', service_to_scale, '--replicas', scaling_settings.replicas.toString(), '--min', scaling_settings.min.toString(), '--max', scaling_settings.max.toString()])
      .it('Sets scaling for service with min and max set', ctx => {
        expect(ctx.stdout).to.contain(`Updated scaling settings for service app of component ${component_version.component.name} in environment ${environment.name}`);
      });

    scale
      .command(['scale', '-e', environment.name, '-a', account.name, `${component_version_name}`, '--service', 'unknown', '--replicas', scaling_settings.replicas.toString()])
      .catch(err => {
        expect(err.message).to.equal(`Component version ${component_version_name} does not have a service called unknown.`);
      })
      .it(`Fails to set scaling for a service that isn't part of the component`);

    const instance_scaling_settings: any = { // TODO: type ScalingSettings?
      scaling_settings: {},
    };
    instance_scaling_settings.scaling_settings[component_version_instance_name] = {};
    instance_scaling_settings.scaling_settings[component_version_instance_name][service_to_scale] = {};
    instance_scaling_settings.scaling_settings[component_version_instance_name][service_to_scale] = { replicas: scaling_settings.replicas };

    mockArchitectAuth
      .nock(MOCK_API_HOST, api => api
        .get(`/accounts/${account.name}`)
        .reply(200, account))
      .nock(MOCK_API_HOST, api => api
        .get(`/accounts/${account.id}/environments/${environment.name}`)
        .reply(200, environment))
      .nock(MOCK_API_HOST, api => api
        .get(`/accounts/${account.name}/components/${instance_component_version.component.name}`)
        .reply(200, instance_component_version.component))
      .nock(MOCK_API_HOST, api => api
        .get(`/components/${instance_component_version.component.component_id}/versions/${instance_component_version.tag}`)
        .reply(200, instance_component_version))
      .nock(MOCK_API_HOST, api => api
        .put(`/environments/${environment.id}`, instance_scaling_settings)
        .reply(200))
      .stdout({ print })
      .stderr({ print })
      .command(['scale', '-e', environment.name, '-a', account.name, `${component_version_instance_name}`, '--service', service_to_scale, '--replicas', scaling_settings.replicas.toString()])
      .it('Sets scaling for service with an instance name set', ctx => {
        expect(ctx.stdout).to.contain(`Updated scaling settings for service app of component ${instance_component_version.component.name} in environment ${environment.name}`);
      });
  });

  describe('Scale services followed by deployments', function() {
    const scale_and_deploy = mockArchitectAuth
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

    const service_to_scale = 'app';
    const scaling_settings = {
      replicas: 5,
      min: 1,
      max: 10,
    };

    const replica_scaling_settings: any = { // TODO: type ScalingSettings?
      scaling_settings: {},
    };
    replica_scaling_settings.scaling_settings[component_version_name] = {};
    replica_scaling_settings.scaling_settings[component_version_name][service_to_scale] = {};
    replica_scaling_settings.scaling_settings[component_version_name][service_to_scale] = { replicas: scaling_settings.replicas };

    scale_and_deploy
      .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
      .stub(PipelineUtils, 'pollPipeline', async () => mock_pipeline)
      .nock(MOCK_API_HOST, api => api
        .put(`/environments/${environment.id}`, replica_scaling_settings)
        .reply(200))
      .nock(MOCK_API_HOST, api => api
        .get(`/accounts/${account.name}`)
        .reply(200, account))
      .nock(MOCK_API_HOST, api => api
        .get(`/accounts/${account.id}/environments/${environment.name}`)
        .reply(200, environment))
      .nock(MOCK_API_HOST, api => api
        .post(`/environments/${environment.id}/deploy`)
        .reply(200, mock_pipeline))
      .nock(MOCK_API_HOST, api => api
        .post(`/pipelines/${mock_pipeline.id}/approve`)
        .reply(200, {}))
      .command(['scale', '-e', environment.name, '-a', account.name, `${component_version_name}`, '--service', service_to_scale, '--replicas', scaling_settings.replicas.toString(), '--auto-approve'])
      .it('Sets service scaling settings, then deploys the component', ctx => {
        expect(ctx.stdout).to.contain(`Updated scaling settings for service app of component ${component_version.component.name} in environment ${environment.name}`);
        expect(ctx.stdout).to.contain(`${component_version_name} Deployed`);
      });
  });
});

