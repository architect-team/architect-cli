import { expect } from 'chai';
import sinon from 'sinon';
import { DockerComposeUtils } from '../../src/common/docker-compose/index';
import PortUtil from '../../src/common/utils/port';
import { ComponentSlugUtils, ComponentVersionSlugUtils, Refs, ServiceVersionSlugUtils, Slugs } from '../../src/dependency-manager/src';
import { mockArchitectAuth, MOCK_API_HOST } from '../utils/mocks';

describe('task:exec', async function () {

  beforeEach(() => {
    sinon.replace(PortUtil, 'isPortAvailable', async () => true);
    PortUtil.reset();
  });

  afterEach(function () {
    sinon.restore();
  });

  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

  const mock_account = {
    id: "ba440d39-97d9-43c3-9f1a-a9a69adb2a41",
    name: "examples",
  }

  const mock_env = {
    id: "81ab04df-97d9-43c3-9f1a-b9c891baf37d",
    name: "dev",
    platform: {
      type: "KUBERNETES",
    },
  }

  const mock_architect_account_response = {
    ...mock_account,
    name: 'architect'
  }

  const mock_component = {
    name: 'basic-task'
  }

  const mock_task = {
    name: 'curler'
  }

  const tag = '1.0.0';

  const namespaced_component_name = ComponentSlugUtils.build(mock_account.name, mock_component.name);
  const tagged_component_name = ComponentVersionSlugUtils.build(mock_account.name, mock_component.name, tag);

  const mock_remote_task_id = 'remote-task-id';
  const mock_local_env_name = 'local';

  mockArchitectAuth
    .stdout({ print })
    .stderr({ print })
    .command(['task:exec', '--help'])
    .it('it succinctly describes the task:exec command', ctx => {
      expect(ctx.stdout).to.contain('Execute a task in the given environment\n')
    });

  mockArchitectAuth
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account)
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.id}/environments/${mock_env.name}`)
      .reply(200, mock_env)
    )
    .nock(MOCK_API_HOST, api => api
      .post(`/environments/${mock_env.id}/exec`, (body) => {
        expect(body.component_account_name).to.eq(mock_account.name);
        expect(body.component_name).to.eq(mock_component.name);
        expect(body.task_name).to.eq(mock_task.name);
        expect(body.tag).to.eq(tag);
        return body;
      })
      .reply(200, mock_remote_task_id)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['task:exec', '-a', mock_account.name, '-e', mock_env.name, tagged_component_name, mock_task.name])
    .it('it reports to the user that the task was executed successfully', ctx => {
      expect(ctx.stdout).to.contain(`Successfully kicked off task. kubernetes reference= ${mock_remote_task_id}`);
    });

  mockArchitectAuth
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account)
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.id}/environments/${mock_env.name}`)
      .reply(200, mock_env)
    )
    .nock(MOCK_API_HOST, api => api
      .post(`/environments/${mock_env.id}/exec`, (body) => {
        expect(body.component_account_name).to.eq(mock_account.name);
        expect(body.component_name).to.eq(mock_component.name);
        expect(body.task_name).to.eq(mock_task.name);
        expect(body.tag).to.eq(Slugs.DEFAULT_TAG);
        return body;
      })
      .reply(200, mock_remote_task_id)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['task:exec', '-a', mock_account.name, '-e', mock_env.name, namespaced_component_name, mock_task.name])
    .it('it reports to the user that the task was executed successfully and assumes latest if the tag was not specified', ctx => {
      expect(ctx.stdout).to.contain(`Successfully kicked off task. kubernetes reference= ${mock_remote_task_id}`);
    });

  const bad_env_name = 'nonexistent-env';
  const bad_component_name = 'nonexistent-component';
  const namespaced_bad_component_name = ComponentSlugUtils.build(mock_account.name, bad_component_name);

  mockArchitectAuth
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account)
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.id}/environments/${bad_env_name}`)
      .reply(404, { message: 'No environment found' })
    )
    .stdout({ print })
    .stderr({ print })
    .command(['task:exec', '-a', mock_account.name, '-e', bad_env_name, tagged_component_name, mock_task.name])
    .catch(err => {
      expect(err.message).to.contain('No environment found')
    })
    .it('fails with a useful message if given a bad environment name');

  mockArchitectAuth
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account)
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account.id}/environments/${mock_env.name}`)
      .reply(200, mock_env)
    )
    .nock(MOCK_API_HOST, api => api
      .post(`/environments/${mock_env.id}/exec`, (body) => {
        expect(body.component_account_name).to.eq(mock_account.name);
        expect(body.component_name).to.eq(bad_component_name);
        expect(body.task_name).to.eq(mock_task.name);
        expect(body.tag).to.eq(Slugs.DEFAULT_TAG);
        return body;
      })
      .reply(404, { message: 'No component found in the given environment' })
    )
    .stdout({ print })
    .stderr({ print })
    .command(['task:exec', '-a', mock_account.name, '-e', mock_env.name, namespaced_bad_component_name, mock_task.name])
    .catch(err => {
      expect(err.message).to.contain('No component found in the given environment')
    })
    .it('fails with a useful message if given a bad component name');

  const mock_docker_compose_service: { [key: string]: {} } = {};
  const ref = Refs.url_safe_ref(ServiceVersionSlugUtils.build(mock_account.name, mock_component.name, mock_task.name, Slugs.DEFAULT_TAG));
  mock_docker_compose_service[ref] = {};
  const mock_docker_compose = {
    services: mock_docker_compose_service
  };

  mockArchitectAuth
    .stub(DockerComposeUtils, 'run', sinon.stub().returns(undefined))
    .stub(DockerComposeUtils, 'loadDockerCompose', sinon.stub().returns(mock_docker_compose))
    .stdout({ print })
    .stderr({ print })
    .command(['task:exec', '-l', namespaced_component_name, mock_task.name])
    .it('it calls docker-compose run when run with the local flag', ctx => {
      const run = DockerComposeUtils.run as sinon.SinonStub;
      const loadDockerCompose = DockerComposeUtils.loadDockerCompose as sinon.SinonStub;
      expect(run.calledOnce).to.be.true;
      expect(loadDockerCompose.calledOnce).to.be.true;

      expect(ctx.stdout).to.contain(`Running task ${namespaced_component_name}/${mock_task.name} in the local ${DockerComposeUtils.DEFAULT_PROJECT} environment...`);
      expect(ctx.stdout).to.contain('Successfully ran task.');
    });

  mockArchitectAuth
    .stub(DockerComposeUtils, 'run', sinon.stub().returns(undefined))
    .stub(DockerComposeUtils, 'loadDockerCompose', sinon.stub().returns(mock_docker_compose))
    .stdout({ print })
    .stderr({ print })
    .command(['task:exec', '-l', '-e', mock_local_env_name, namespaced_component_name, mock_task.name])
    .it('it calls docker-compose run when run with the local flag and sets project to given environment flag', ctx => {
      const run = DockerComposeUtils.run as sinon.SinonStub;
      const loadDockerCompose = DockerComposeUtils.loadDockerCompose as sinon.SinonStub;
      expect(run.calledOnce).to.be.true;
      expect(loadDockerCompose.calledOnce).to.be.true;

      expect(ctx.stdout).to.contain(`Running task ${namespaced_component_name}/${mock_task.name} in the local ${mock_local_env_name} environment...`);
      expect(ctx.stdout).to.contain('Successfully ran task.');
    });

  mockArchitectAuth
    .stub(DockerComposeUtils, 'run', sinon.stub().returns(undefined))
    .stub(DockerComposeUtils, 'loadDockerCompose', sinon.stub().throws(new Error('docker compose not found')))
    .stdout({ print })
    .stderr({ print })
    .command(['task:exec', '-l', namespaced_component_name, mock_task.name])
    .catch(err => {
      expect(err.message).to.contain(`Could not find docker compose file at ${DockerComposeUtils.buildComposeFilepath('test', DockerComposeUtils.DEFAULT_PROJECT)}. Please run \`architect deploy -l -e ${DockerComposeUtils.DEFAULT_PROJECT} ${namespaced_component_name}\` before executing any tasks in your local ${DockerComposeUtils.DEFAULT_PROJECT} environment.`);
    })
    .it('fails with a useful message if no docker compose file is found');

  mockArchitectAuth
    .stub(DockerComposeUtils, 'run', sinon.stub().returns(undefined))
    .stub(DockerComposeUtils, 'loadDockerCompose', sinon.stub().throws(new Error('docker compose not found')))
    .stdout({ print })
    .stderr({ print })
    .command(['task:exec', '-l', '-e', mock_local_env_name, namespaced_component_name, mock_task.name])
    .catch(err => {
      expect(err.message).to.contain(`Could not find docker compose file at ${DockerComposeUtils.buildComposeFilepath('test', mock_local_env_name)}. Please run \`architect deploy -l -e ${mock_local_env_name} ${namespaced_component_name}\` before executing any tasks in your local ${mock_local_env_name} environment.`);
    })
    .it('fails with a useful message if no docker compose file is found');

  mockArchitectAuth
    .stub(DockerComposeUtils, 'run', sinon.stub().returns(undefined))
    .stub(DockerComposeUtils, 'loadDockerCompose', sinon.stub().returns({ services: {} }))
    .stdout({ print })
    .stderr({ print })
    .command(['task:exec', '-l', namespaced_component_name, mock_task.name])
    .catch(err => {
      expect(err.message).to.contain(`Could not find ${namespaced_component_name}/${mock_task.name} running in your local ${DockerComposeUtils.DEFAULT_PROJECT} environment`);
    })
    .it('fails with a useful message if the specified task is not present in the docker compose');

  mockArchitectAuth
    .stub(DockerComposeUtils, 'run', sinon.stub().returns(undefined))
    .stub(DockerComposeUtils, 'loadDockerCompose', sinon.stub().returns({ services: {} }))
    .stdout({ print })
    .stderr({ print })
    .command(['task:exec', '-l', '-e', mock_local_env_name, namespaced_component_name, mock_task.name])
    .catch(err => {
      expect(err.message).to.contain(`Could not find ${namespaced_component_name}/${mock_task.name} running in your local ${mock_local_env_name} environment`);
    })
    .it('fails with a useful message that includes the local_environment name if the specified task is not present in the docker compose');
});
