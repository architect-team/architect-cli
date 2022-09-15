import { expect } from '@oclif/test';
import sinon, { SinonSpy } from 'sinon';
import { mockArchitectAuth } from '../utils/mocks';
import Stop from '../../src/commands/stop';
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
  const print = false;

  const env = { 'test_env': [createTestContainer('container_name_1')] };
  
  const container_states = [
    {
      ID: 'abc',
      Project: 'test_env',
      Service: 'my--app',
      State: 'exited',
      Health: '',
      ExitCode: 0,
    }
  ]
  
  mockArchitectAuth
    .stub(DockerComposeUtils, 'getLocalEnvironmentContainerMap', sinon.stub().returns(env))
    .stub(Stop.prototype, 'log', sinon.fake.returns(null))
    .stub(DockerComposeUtils, 'dockerCompose', sinon.stub().returns(container_states))
    .command(['stop', 'test_env'])
    .it('stop a local deployment', ctx => {
      const log_spy = Stop.prototype.log as SinonSpy;
      expect(log_spy.firstCall.args[0]).to.contain("Successfully stopped local deployment");

      const compose = DockerComposeUtils.dockerCompose as sinon.SinonStub;
      expect(compose.callCount).to.eq(1);
      expect(compose.firstCall.firstArg[1]).to.equal('test_env');
    });
  
  mockArchitectAuth
    .stub(DockerComposeUtils, 'getLocalEnvironmentContainerMap', sinon.stub().returns({}))
    .stub(Stop.prototype, 'log', sinon.fake.returns(null))
    .command(['stop', 'failed_env'])
    .catch(err => {
      expect(process.exitCode).eq(1);
      expect(`${err}`).to.contain('No local deployment found');
    })
    .it('cannot stop a local deployment in empty environment');
  
  mockArchitectAuth
    .stub(DockerComposeUtils, 'getLocalEnvironmentContainerMap', sinon.stub().returns(env))
    .stub(Stop.prototype, 'log', sinon.fake.returns(null))
    .command(['stop', 'failed_env'])
    .catch(err => {
      expect(process.exitCode).eq(1);
      expect(`${err}`).to.contain(`No local deployment named 'failed_env'`);
    })
    .it('cannot stop a non-existed local deployment');
});
