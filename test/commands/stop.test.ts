import { expect } from '@oclif/test';
import sinon, { SinonSpy } from 'sinon';
import { mockArchitectAuth } from '../utils/mocks';
import KillLocalDeployment from '../../src/commands/stop';
import { DockerComposeUtils } from '../../src/common/docker-compose';

function createTestContainer(name: string, image_name?: string) {
  const test_container: any = {
    Name: image_name || 'image_name_not_used',
    State: {
      Status: 'running',
    },
    Config: {
      Labels: {},
    },
  };

  if (!image_name) {
    test_container.Config.Labels['com.docker.compose.service'] = name;
  }

  return test_container;
}

describe('stop', () => {

  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = true;

  const container_name_env = { 'arc_test_env_1': [createTestContainer('container_name_1')] };
  const image_name_env = { 'test_env': [createTestContainer('container_name_not_used', 'image_name_is_used')] };
  
  mockArchitectAuth
    .stub(DockerComposeUtils, 'getLocalEnvironmentContainerMap', sinon.stub().returns(container_name_env))
    .stub(KillLocalDeployment.prototype, 'log', sinon.fake.returns(null))
    .command(['stop', 'arc_test_env_1'])
    .it('kill a local deployment using container name', ctx => {
      const log_spy = KillLocalDeployment.prototype.log as SinonSpy;
      expect(log_spy.firstCall.args[0]).to.contain('Successfully killed local deployment');
    });

  mockArchitectAuth
    .stub(DockerComposeUtils, 'getLocalEnvironmentContainerMap', sinon.stub().returns({}))
    .stub(KillLocalDeployment.prototype, 'log', sinon.fake.returns(null))
    .command(['stop', 'arc_test_env_1'])
    .catch(err => {
      expect(process.exitCode).eq(1);
      expect(`${err}`).to.contain('No local deployment found');
    })
    .it('cannot kill a local deployment in empty environment');
  
  mockArchitectAuth
    .stub(DockerComposeUtils, 'getLocalEnvironmentContainerMap', sinon.stub().returns(container_name_env))
    .stub(KillLocalDeployment.prototype, 'log', sinon.fake.returns(null))
    .command(['stop', 'non_existed_env'])
    .catch(err => {
      expect(process.exitCode).eq(1);
      expect(`${err}`).to.contain(`Environment 'non_existed_env' does not have any running container`);
    })
    .it('cannot kill a non-existed local deployment');
  
  mockArchitectAuth
    .stub(DockerComposeUtils, 'getLocalEnvironmentContainerMap', sinon.stub().returns(image_name_env))
    .stub(KillLocalDeployment.prototype, 'log', sinon.fake.returns(null))
    .command(['stop', 'test_env'])
    .it('kill a local deployment using image name', ctx => {
      const log_spy = KillLocalDeployment.prototype.log as SinonSpy;
      expect(log_spy.firstCall.args[0]).to.contain("Successfully killed local deployment");
    });
});
