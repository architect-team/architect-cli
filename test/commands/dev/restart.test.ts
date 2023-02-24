import { expect } from '@oclif/test';
import sinon, { SinonSpy } from 'sinon';
import DevRestart from '../../../src/commands/dev/restart';
import { DockerComposeUtils } from '../../../src/common/docker-compose';
import { mockArchitectAuth } from '../../utils/mocks';

describe('dev:restart', () => {
  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = true;

  const test_env_name = 'test_env';
  const test_service_name = 'test--service';

  mockArchitectAuth()
    .stub(DockerComposeUtils, 'getLocalEnvironment', sinon.stub().returns(test_env_name))
    .stub(DevRestart.prototype, 'log', sinon.fake.returns(null))
    .stub(DockerComposeUtils, 'getLocalServiceForEnvironment', sinon.stub().returns({ name: test_service_name }))
    .stub(DockerComposeUtils, 'dockerCompose', sinon.stub().returns(null))
    .command(['dev:restart'])
    .it('restart a service with no args', ctx => {
      const log_spy = DevRestart.prototype.log as SinonSpy;
      expect(log_spy.firstCall.args[0]).to.contain('Finished restarting');

      const compose_local_svc = DockerComposeUtils.getLocalServiceForEnvironment as sinon.SinonStub;
      expect(compose_local_svc.callCount).to.eq(1);
      // dev:restart with no args calls getLocalServiceForEnvironment with 1 arg to prompt service name
      expect(compose_local_svc.firstCall.args.length).to.eq(1);

      const compose = DockerComposeUtils.dockerCompose as sinon.SinonStub;
      expect(compose.firstCall.args.length).to.eq(2);
      expect(compose.firstCall.args[0]).to.deep.equal(['-f', `test/docker-compose/${test_env_name}.yml`, '-p', test_env_name, 'restart', test_service_name]);
    });

  mockArchitectAuth()
    .stub(DockerComposeUtils, 'getLocalEnvironment', sinon.stub().returns(test_env_name))
    .stub(DevRestart.prototype, 'log', sinon.fake.returns(null))
    .stub(DockerComposeUtils, 'getLocalServiceForEnvironment', sinon.stub().returns({ name: test_service_name }))
    .stub(DockerComposeUtils, 'dockerCompose', sinon.stub().returns(null))
    .command(['dev:restart', '--build'])
    .it('rebuild a service with no args', ctx => {
      const log_spy = DevRestart.prototype.log as SinonSpy;
      expect(log_spy.firstCall.args[0]).to.contain('Finished rebuilding');

      const compose_local_svc = DockerComposeUtils.getLocalServiceForEnvironment as sinon.SinonStub;
      expect(compose_local_svc.callCount).to.eq(1);
      // dev:restart with no args calls getLocalServiceForEnvironment with 1 arg to prompt service name
      expect(compose_local_svc.firstCall.args.length).to.eq(1);

      const compose = DockerComposeUtils.dockerCompose as sinon.SinonStub;
      expect(compose.firstCall.args.length).to.eq(2);
      expect(compose.firstCall.args[0]).to.deep.equal(['-f', `test/docker-compose/${test_env_name}.yml`,
        '-p', test_env_name, 'up', '--build', '--force-recreate', '--detach', test_service_name]);
    });
});
