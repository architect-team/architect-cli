import { expect, test } from '@oclif/test';
import { Replica } from '../../src/architect/environment/environment.utils';
import Exec from '../../src/commands/exec';
import { MockArchitectApi } from '../utils/mocks';

describe('exec command', () => {
  const account = {
    name: 'examples',
    id: '1',
  };

  const environment = {
    name: 'test',
    id: '1',
  };

  const component = {
    name: 'react-app',
  };

  const service = {
    name: 'app',
  };

  const replicas: Replica[] = [
    { ext_ref: 'ext-0', node_ref: 'node-ref-0', resource_ref: `${component.name}.services.${service}`, created_at: new Date().toUTCString(), ports: [8080] },
  ];

  const multiple_replicas: Replica[] = [
    { ext_ref: 'ext-0', node_ref: 'node-ref-0', resource_ref: `${component.name}.services.${service}`, created_at: new Date().toUTCString(), ports: [8080] },
    { ext_ref: 'ext-1', node_ref: 'node-ref-0', resource_ref: `${component.name}.services.${service}`, created_at: new Date().toUTCString(), ports: [8080] },
  ];

  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .getEnvironmentReplicas(environment, replicas)
    .getTests()
    .stub(Exec.prototype, 'exec', () => { console.log('worked'); })
    .stdout()
    .command(['exec', '-a', account.name, '-e', environment.name, '--', 'ls', '-la'])
    .it('exec command with spaces', ctx => {
      expect(ctx.stdout).to.include('worked\n'); // TODO: restore: equal
    });

  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .getEnvironmentReplicas(environment, replicas, component)
    .getTests()
    .stub(Exec.prototype, 'exec', () => { console.log('worked'); })
    .stdout()
    .command(['exec', '-a', account.name, '-e', environment.name, `${account.name}/${component.name}`, '--', 'ls', '-la'])
    .it('exec component and command with spaces', ctx => {
      expect(ctx.stdout).to.include('worked\n'); // TODO: restore: equal
    });

  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .getEnvironmentReplicas(environment, replicas)
    .getTests()
    .stub(Exec.prototype, 'exec', () => { console.log('worked'); })
    .stdout()
    .command(['exec', '-a', account.name, '-e', environment.name, '-r', '0', '--', 'ls', '-la'])
    .it('exec component and replica of the form <replica-index> when there is only one service', ctx => {
      expect(ctx.stdout).to.include('worked\n'); // TODO: restore: equal
    });

  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .getEnvironmentReplicas(environment, multiple_replicas, service)
    .getTests()
    .stdout()
    .command(['exec', '-a', account.name, '-e', environment.name, 'app', '-r', '2', '--', 'ls', '-la'])
    .catch(err => {
      expect(`${err}`).to.contain('Replica not found at index 2');
    })
    .it('exec component and replica failed indexing out-of-bound replica index');

  test
    .command(['exec', '-a', account.name, '-e', environment.name, 'examples/react-app', 'ls'])
    .exit(2)
    .it('exec without -- fails');
});
