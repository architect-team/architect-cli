import { expect } from '@oclif/test';
import sinon, { SinonSpy } from 'sinon';
import DevStop from '../../../src/commands/dev/stop';
import { DockerComposeUtils } from '../../../src/common/docker-compose';
import { mockArchitectAuth } from '../../utils/mocks';

describe('dev:stop', () => {

  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

  const env_names = ['test_env'];

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
    .stub(DockerComposeUtils, 'getLocalEnvironments', sinon.stub().returns(env_names))
    .stub(DevStop.prototype, 'waitForEnviromentToStop', sinon.stub().returns(true))
    .stub(DevStop.prototype, 'log', sinon.fake.returns(null))
    .stub(DockerComposeUtils, 'dockerCompose', sinon.stub().returns(container_states))
    .command(['dev:stop', 'test_env'])
    .it('stop a local deployment', ctx => {
      const log_spy = DevStop.prototype.log as SinonSpy;
      expect(log_spy.firstCall.args[0]).to.contain("Successfully stopped local deployment");

      const compose = DockerComposeUtils.dockerCompose as sinon.SinonStub;
      expect(compose.callCount).to.eq(1);
      expect(compose.firstCall.firstArg[1]).to.equal('test_env');
    });

  mockArchitectAuth
    .stub(DockerComposeUtils, 'getLocalEnvironments', sinon.stub().returns([]))
    .stub(DevStop.prototype, 'waitForEnviromentToStop', sinon.stub().returns(true))
    .stub(DevStop.prototype, 'log', sinon.fake.returns(null))
    .command(['dev:stop', 'failed_env'])
    .catch(err => {
      expect(process.exitCode).eq(1);
      expect(`${err}`).to.contain('No local deployment found');
    })
    .it('cannot stop a local deployment in empty environment');

  mockArchitectAuth
    .stub(DockerComposeUtils, 'getLocalEnvironments', sinon.stub().returns(env_names))
    .stub(DevStop.prototype, 'waitForEnviromentToStop', sinon.stub().returns(false))
    .stub(DevStop.prototype, 'log', sinon.fake.returns(null))
    .command(['dev:stop', 'test_env'])
    .catch(err => {
      expect(process.exitCode).eq(1);
      expect(`${err}`).to.contain('Unable to stop test_env');
    })
    .it('handles not stopping gracefully');

  mockArchitectAuth
    .stub(DockerComposeUtils, 'getLocalEnvironments', sinon.stub().returns(env_names))
    .stub(DevStop.prototype, 'waitForEnviromentToStop', sinon.stub().returns(true))
    .stub(DevStop.prototype, 'log', sinon.fake.returns(null))
    .command(['dev:stop', 'failed_env'])
    .catch(err => {
      expect(process.exitCode).eq(1);
      expect(`${err}`).to.contain(`No local deployment named 'failed_env'`);
    })
    .it('cannot stop a non-existed local deployment');
});
