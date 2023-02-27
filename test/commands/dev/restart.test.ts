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
  const test_service_name_2 = 'test--service-2';

  // Helper stubs for the result of getLocalServiceForEnvironment() in various situations
  const local_service_result = () => sinon.stub().returns({ name: test_service_name });
  const multiarg_local_service_result = () => sinon.stub().onCall(0).returns({ name: test_service_name })
    .onCall(1).returns({ name: test_service_name_2 });

  mockArchitectAuth()
    .stub(DockerComposeUtils, 'getLocalEnvironment', sinon.stub().returns(test_env_name))
    .stub(DevRestart.prototype, 'log', sinon.fake.returns(null))
    .stub(DockerComposeUtils, 'getLocalServiceForEnvironment', local_service_result())
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
      expect(compose.firstCall.args[0]).to.deep.equal([
        '-f', `test/docker-compose/${test_env_name}.yml`,
        '-p', test_env_name, 'restart', test_service_name,
      ]);
    });

  mockArchitectAuth()
    .stub(DockerComposeUtils, 'getLocalEnvironment', sinon.stub().returns(test_env_name))
    .stub(DevRestart.prototype, 'log', sinon.fake.returns(null))
    .stub(DockerComposeUtils, 'getLocalServiceForEnvironment', local_service_result())
    .stub(DockerComposeUtils, 'dockerCompose', sinon.stub().returns(null))
    .command(['dev:restart', 'test.service.name'])
    .it('restart a service with single arg', ctx => {
      const log_spy = DevRestart.prototype.log as SinonSpy;
      expect(log_spy.firstCall.args[0]).to.contain('Finished restarting');

      const compose_local_svc = DockerComposeUtils.getLocalServiceForEnvironment as sinon.SinonStub;
      expect(compose_local_svc.callCount).to.eq(1);
      expect(compose_local_svc.firstCall.args.length).to.eq(2);
      expect(compose_local_svc.firstCall.args[1]).to.eq('test.service.name');

      const compose = DockerComposeUtils.dockerCompose as sinon.SinonStub;
      expect(compose.firstCall.args.length).to.eq(2);
      expect(compose.firstCall.args[0]).to.deep.equal([
        '-f', `test/docker-compose/${test_env_name}.yml`,
        '-p', test_env_name, 'restart', test_service_name,
      ]);
    });

  mockArchitectAuth()
    .stub(DockerComposeUtils, 'getLocalEnvironment', sinon.stub().returns(test_env_name))
    .stub(DevRestart.prototype, 'log', sinon.fake.returns(null))
    .stub(DockerComposeUtils, 'getLocalServiceForEnvironment', multiarg_local_service_result())
    .stub(DockerComposeUtils, 'dockerCompose', sinon.stub().returns(null))
    .command(['dev:restart', 'test.service.name', 'test2.service.name'])
    .it('restart a service with multiple args', ctx => {
      const log_spy = DevRestart.prototype.log as SinonSpy;
      expect(log_spy.firstCall.args[0]).to.contain('Finished restarting');

      const compose_local_svc = DockerComposeUtils.getLocalServiceForEnvironment as sinon.SinonStub;
      expect(compose_local_svc.callCount).to.eq(2);
      expect(compose_local_svc.firstCall.args.length).to.eq(2);
      expect(compose_local_svc.firstCall.args[1]).to.eq('test.service.name');
      expect(compose_local_svc.lastCall.args[1]).to.eq('test2.service.name');

      const compose = DockerComposeUtils.dockerCompose as sinon.SinonStub;
      expect(compose.firstCall.args.length).to.eq(2);
      expect(compose.firstCall.args[0]).to.deep.equal([
        '-f', `test/docker-compose/${test_env_name}.yml`, '-p',
        test_env_name, 'restart', test_service_name, test_service_name_2,
      ]);
    });

  mockArchitectAuth()
    .stub(DockerComposeUtils, 'getLocalEnvironment', sinon.stub().returns(test_env_name))
    .stub(DevRestart.prototype, 'log', sinon.fake.returns(null))
    .stub(DockerComposeUtils, 'getLocalServiceForEnvironment', local_service_result())
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

  mockArchitectAuth()
    .stub(DockerComposeUtils, 'getLocalEnvironment', sinon.stub().returns(test_env_name))
    .stub(DevRestart.prototype, 'log', sinon.fake.returns(null))
    .stub(DockerComposeUtils, 'getLocalServiceForEnvironment', local_service_result())
    .stub(DockerComposeUtils, 'dockerCompose', sinon.stub().returns(null))
    .command(['dev:restart', '--build', 'test.service.name'])
    .it('rebuild a service with single arg', ctx => {
      const log_spy = DevRestart.prototype.log as SinonSpy;
      expect(log_spy.firstCall.args[0]).to.contain('Finished rebuilding');

      const compose_local_svc = DockerComposeUtils.getLocalServiceForEnvironment as sinon.SinonStub;
      expect(compose_local_svc.callCount).to.eq(1);
      expect(compose_local_svc.firstCall.args.length).to.eq(2);
      expect(compose_local_svc.firstCall.args[1]).to.eq('test.service.name');

      const compose = DockerComposeUtils.dockerCompose as sinon.SinonStub;
      expect(compose.firstCall.args.length).to.eq(2);
      expect(compose.firstCall.args[0]).to.deep.equal(['-f', `test/docker-compose/${test_env_name}.yml`,
        '-p', test_env_name, 'up', '--build', '--force-recreate', '--detach', test_service_name]);
    });

  mockArchitectAuth()
    .stub(DockerComposeUtils, 'getLocalEnvironment', sinon.stub().returns(test_env_name))
    .stub(DevRestart.prototype, 'log', sinon.fake.returns(null))
    .stub(DockerComposeUtils, 'getLocalServiceForEnvironment', multiarg_local_service_result())
    .stub(DockerComposeUtils, 'dockerCompose', sinon.stub().returns(null))
    .command(['dev:restart', '--build', 'test.service.name', 'test2.service.name'])
    .it('rebuild a service with multiple args', ctx => {
      const log_spy = DevRestart.prototype.log as SinonSpy;
      expect(log_spy.firstCall.args[0]).to.contain('Finished rebuilding');

      const compose_local_svc = DockerComposeUtils.getLocalServiceForEnvironment as sinon.SinonStub;
      expect(compose_local_svc.callCount).to.eq(2);
      expect(compose_local_svc.firstCall.args.length).to.eq(2);
      expect(compose_local_svc.firstCall.args[1]).to.eq('test.service.name');
      expect(compose_local_svc.lastCall.args[1]).to.eq('test2.service.name');

      const compose = DockerComposeUtils.dockerCompose as sinon.SinonStub;
      expect(compose.firstCall.args.length).to.eq(2);
      expect(compose.firstCall.args[0]).to.deep.equal([
        '-f', `test/docker-compose/${test_env_name}.yml`,
        '-p', test_env_name, 'up', '--build', '--force-recreate',
        '--detach', test_service_name, test_service_name_2,
      ]);
    });
});
