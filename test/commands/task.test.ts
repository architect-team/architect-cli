import { expect } from 'chai';
import path from 'path';
import sinon from 'sinon';
import { ComponentSlugUtils, ComponentVersionSlugUtils, resourceRefToNodeRef, ResourceSlugUtils } from '../../src/';
import { DockerComposeUtils } from '../../src/common/docker-compose/index';
import { MockArchitectApi } from '../utils/mocks';

describe('task:exec', async function () {
  const mock_account = {
    id: "ba440d39-97d9-43c3-9f1a-a9a69adb2a41",
    name: "examples",
  };

  const mock_env = {
    id: "81ab04df-97d9-43c3-9f1a-b9c891baf37d",
    name: "dev",
    cluster: {
      type: "KUBERNETES",
    },
  };

  const mock_component = {
    name: 'basic-task',
  };

  const mock_task = {
    name: 'curler',
  };

  const tag = '1.0.0';

  const instance_name = 'instance-2';

  const namespaced_component_name = ComponentSlugUtils.build(mock_component.name);
  const task_name = ResourceSlugUtils.build(mock_component.name, 'tasks', mock_task.name);
  const tagged_component_name = ComponentVersionSlugUtils.build(mock_component.name, tag);
  const instanced_task_name = ResourceSlugUtils.build(mock_component.name, 'tasks', mock_task.name, instance_name);
  const instanced_component_name = ComponentVersionSlugUtils.build(mock_component.name, tag, instance_name);

  const mock_remote_task_id = 'remote-task-id';
  const mock_local_env_name = 'local';

  new MockArchitectApi()
    .getAccount(mock_account)
    .getEnvironment(mock_account, mock_env)
    .environmentExec(mock_env, mock_remote_task_id, { body:
      (body) => {
        expect(body.component_account_name).to.eq(mock_account.name);
        expect(body.component_name).to.eq(mock_component.name);
        expect(body.task_name).to.eq(mock_task.name);
        return body;
      }
    })
    .getTests()
    .command(['task:exec', '-a', mock_account.name, '-e', mock_env.name, tagged_component_name, mock_task.name])
    .it('it reports to the user that the task was executed successfully', ctx => {
      expect(ctx.stdout).to.contain(`Successfully kicked off task. kubernetes reference= ${mock_remote_task_id}`);
    });

  new MockArchitectApi()
    .getAccount(mock_account)
    .getEnvironment(mock_account, mock_env)
    .environmentExec(mock_env, mock_remote_task_id, { body:
      (body) => {
        expect(body.component_account_name).to.eq(mock_account.name);
        expect(body.component_name).to.eq(mock_component.name);
        expect(body.task_name).to.eq(mock_task.name);
        return body;
      }
    })
    .getTests()
    .command(['task:exec', '-a', mock_account.name, '-e', mock_env.name, namespaced_component_name, mock_task.name])
    .it('it reports to the user that the task was executed successfully and assumes latest if the tag was not specified', ctx => {
      expect(ctx.stdout).to.contain(`Successfully kicked off task. kubernetes reference= ${mock_remote_task_id}`);
    });

  new MockArchitectApi()
    .getAccount(mock_account)
    .getEnvironment(mock_account, mock_env)
    .environmentExec(mock_env, mock_remote_task_id, { body:
      (body) => {
        expect(body.component_account_name).to.eq(mock_account.name);
        expect(body.component_name).to.eq(mock_component.name);
        expect(body.instance_name).to.eq(instance_name);
        expect(body.task_name).to.eq(mock_task.name);
        return body;
      }
    })
    .getTests()
    .command(['task:exec', '-a', mock_account.name, '-e', mock_env.name, instanced_component_name, mock_task.name])
    .it('it reports to the user that the task was executed successfully if run with an instance_name', ctx => {
      expect(ctx.stdout).to.contain(`Successfully kicked off task. kubernetes reference= ${mock_remote_task_id}`);
    });

  const bad_mock_env = { name: 'nonexistent-env' };
  const bad_component_name = 'nonexistent-component';
  const namespaced_bad_component_name = ComponentSlugUtils.build(bad_component_name);

  new MockArchitectApi()
    .getAccount(mock_account)
    .getEnvironment(mock_account, bad_mock_env, { response_code: 404, response: { message: 'No environment found' } })
    .getTests()
    .command(['task:exec', '-a', mock_account.name, '-e', bad_mock_env.name, tagged_component_name, mock_task.name])
    .catch(err => {
      expect(err.message).to.contain(`Environment '${bad_mock_env.name}' not found`)
    })
    .it('fails with a useful message if given a bad environment name');

  new MockArchitectApi()
    .getAccount(mock_account)
    .getEnvironment(mock_account, mock_env)
    .environmentExec(mock_env, mock_remote_task_id, { body:
      (body) => {
        expect(body.component_account_name).to.eq(mock_account.name);
        expect(body.component_name).to.eq(bad_component_name);
        expect(body.task_name).to.eq(mock_task.name);
        return body;
      }, response_code: 404, response: { message: 'No component found in the given environment' }})
    .getTests()
    .command(['task:exec', '-a', mock_account.name, '-e', mock_env.name, namespaced_bad_component_name, mock_task.name])
    .catch(err => {
      expect(err.message).to.contain('No component found in the given environment')
    })
    .it('fails with a useful message if given a bad component name');

  const mock_docker_compose_service: { [key: string]: {} } = {};
  const mock_slug = ResourceSlugUtils.build(mock_component.name, 'tasks', mock_task.name);
  const mock_ref = resourceRefToNodeRef(mock_slug);
  const instanced_mock_slug = ResourceSlugUtils.build(mock_component.name, 'tasks', mock_task.name, instance_name);
  const instanced_mock_ref = resourceRefToNodeRef(instanced_mock_slug);
  mock_docker_compose_service[mock_ref] = {};
  mock_docker_compose_service[instanced_mock_ref] = {};
  const mock_docker_compose = {
    services: mock_docker_compose_service,
  };

  new MockArchitectApi()
    .getTests()
    .stub(DockerComposeUtils, 'run', sinon.stub().returns(undefined))
    .stub(DockerComposeUtils, 'loadDockerCompose', sinon.stub().returns(mock_docker_compose))
    .stub(DockerComposeUtils, 'getProjectName', sinon.stub().returns(mock_component.name))
    .command(['task:exec', '-l', namespaced_component_name, mock_task.name])
    .it('it calls docker-compose run when run with the local flag', ctx => {
      const run = DockerComposeUtils.run as sinon.SinonStub;
      const loadDockerCompose = DockerComposeUtils.loadDockerCompose as sinon.SinonStub;
      expect(run.calledOnce).to.be.true;
      expect(loadDockerCompose.calledOnce).to.be.true;

      expect(ctx.stdout).to.contain(`Running task ${task_name} in the local ${DockerComposeUtils.DEFAULT_PROJECT} environment...`);
      expect(ctx.stdout).to.contain('Successfully ran task.');
    });

  new MockArchitectApi()
    .getTests()
    .stub(DockerComposeUtils, 'run', sinon.stub().returns(undefined))
    .stub(DockerComposeUtils, 'loadDockerCompose', sinon.stub().returns(mock_docker_compose))
    .stub(DockerComposeUtils, 'getProjectName', sinon.stub().returns(mock_component.name))
    .command(['task:exec', '-l', namespaced_component_name, mock_task.name])
    .it('task to be run is found by matching hash of specified service', ctx => {
      const loadDockerCompose = DockerComposeUtils.loadDockerCompose as sinon.SinonStub;
      const runDockerCompose = DockerComposeUtils.run as sinon.SinonStub;
      expect(runDockerCompose.calledOnce).to.be.true;
      expect(runDockerCompose.args[0]).to.deep.equal([mock_ref, 'architect', path.join('test', 'docker-compose', 'architect.yml')]);
      expect(loadDockerCompose.calledOnce).to.be.true;
    });

  new MockArchitectApi()
    .getTests()
    .stub(DockerComposeUtils, 'run', sinon.stub().returns(undefined))
    .stub(DockerComposeUtils, 'loadDockerCompose', sinon.stub().returns(mock_docker_compose))
    .stub(DockerComposeUtils, 'getProjectName', sinon.stub().returns(mock_local_env_name))
    .command(['task:exec', '-l', '-e', mock_local_env_name, namespaced_component_name, mock_task.name])
    .it('it calls docker-compose run when run with the local flag and sets project to given environment flag', ctx => {
      const run = DockerComposeUtils.run as sinon.SinonStub;
      const loadDockerCompose = DockerComposeUtils.loadDockerCompose as sinon.SinonStub;
      expect(run.calledOnce).to.be.true;
      expect(loadDockerCompose.calledOnce).to.be.true;

      expect(ctx.stdout).to.contain(`Running task ${task_name} in the local ${mock_local_env_name} environment...`);
      expect(ctx.stdout).to.contain('Successfully ran task.');
    });

  new MockArchitectApi()
    .getTests()
    .stub(DockerComposeUtils, 'run', sinon.stub().returns(undefined))
    .stub(DockerComposeUtils, 'loadDockerCompose', sinon.stub().returns(mock_docker_compose))
    .stub(DockerComposeUtils, 'getProjectName', sinon.stub().returns(mock_local_env_name))
    .command(['task:exec', '-l', '-e', mock_local_env_name, instanced_component_name, mock_task.name])
    .it('it calls docker-compose run when run with the local flag and sets project to given environment flag and works with instance_name', ctx => {
      const run = DockerComposeUtils.run as sinon.SinonStub;
      const loadDockerCompose = DockerComposeUtils.loadDockerCompose as sinon.SinonStub;
      expect(run.calledOnce).to.be.true;
      expect(loadDockerCompose.calledOnce).to.be.true;

      expect(ctx.stdout).to.contain(`Running task ${instanced_task_name} in the local ${mock_local_env_name} environment...`);
      expect(ctx.stdout).to.contain('Successfully ran task.');
    });

  new MockArchitectApi()
    .getTests()
    .stub(DockerComposeUtils, 'run', sinon.stub().returns(undefined))
    .stub(DockerComposeUtils, 'loadDockerCompose', sinon.stub().throws(new Error('docker compose not found')))
    .stub(DockerComposeUtils, 'getProjectName', sinon.stub().returns(mock_component.name))
    .command(['task:exec', '-l', namespaced_component_name, mock_task.name])
    .catch(err => {
      expect(err.message).to.contain(`Could not find docker compose file at ${DockerComposeUtils.buildComposeFilepath('test', DockerComposeUtils.DEFAULT_PROJECT)}. Please run \`architect dev -e ${DockerComposeUtils.DEFAULT_PROJECT} ${namespaced_component_name}\` before executing any tasks in your local ${DockerComposeUtils.DEFAULT_PROJECT} environment.`);
    })
    .it('fails with a useful message if no docker compose file is found');

  new MockArchitectApi()
    .getTests()
    .stub(DockerComposeUtils, 'run', sinon.stub().returns(undefined))
    .stub(DockerComposeUtils, 'loadDockerCompose', sinon.stub().throws(new Error('docker compose not found')))
    .stub(DockerComposeUtils, 'getProjectName', sinon.stub().returns(mock_local_env_name))
    .command(['task:exec', '-l', '-e', mock_local_env_name, namespaced_component_name, mock_task.name])
    .catch(err => {
      expect(err.message).to.contain(`Could not find docker compose file at ${DockerComposeUtils.buildComposeFilepath('test', mock_local_env_name)}. Please run \`architect dev -e ${mock_local_env_name} ${namespaced_component_name}\` before executing any tasks in your local ${mock_local_env_name} environment.`);
    })
    .it('fails with a useful message if no docker compose file is found using environment');

  new MockArchitectApi()
    .getTests()
    .stub(DockerComposeUtils, 'run', sinon.stub().returns(undefined))
    .stub(DockerComposeUtils, 'loadDockerCompose', sinon.stub().returns({ services: {} }))
    .stub(DockerComposeUtils, 'getProjectName', sinon.stub().returns(mock_component.name))
    .command(['task:exec', '-l', namespaced_component_name, mock_task.name])
    .catch(err => {
      expect(err.message).to.contain(`Could not find ${task_name} running in your local ${DockerComposeUtils.DEFAULT_PROJECT} environment`);
    })
    .it('fails with a useful message if the specified task is not present in the docker compose');

  new MockArchitectApi()
    .getTests()
    .stub(DockerComposeUtils, 'run', sinon.stub().returns(undefined))
    .stub(DockerComposeUtils, 'loadDockerCompose', sinon.stub().returns({ services: {} }))
    .stub(DockerComposeUtils, 'getProjectName', sinon.stub().returns(mock_local_env_name))
    .command(['task:exec', '-l', '-e', mock_local_env_name, namespaced_component_name, mock_task.name])
    .catch(err => {
      expect(err.message).to.contain(`Could not find ${task_name} running in your local ${mock_local_env_name} environment`);
    })
    .it('fails with a useful message that includes the local_environment name if the specified task is not present in the docker compose');
});
