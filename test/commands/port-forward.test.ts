import { expect } from '@oclif/test';
import * as net from 'net';
import { Replica } from '../../src/architect/environment/environment.utils';
import PortForward from '../../src/commands/port-forward';
import { MockArchitectApi } from '../utils/mocks';

describe('port-forward command', () => {
  const account = {
    name: 'examples',
    id: '1',
  };
  const environment = {
    name: 'test',
    id: '1',
  };
  const replicas: Replica[] = [
    { ext_ref: 'ext-0', node_ref: 'node-ref-0', resource_ref: 'my-app.services.app', created_at: new Date().toUTCString(), ports: [8080] },
  ];

  const multiple_replicas: Replica[] = [
    { ext_ref: 'ext-0', node_ref: 'node-ref-0', resource_ref: 'my-app.services.app', created_at: new Date().toUTCString(), ports: [8080] },
    { ext_ref: 'ext-1', node_ref: 'node-ref-0', resource_ref: 'my-app.services.app', created_at: new Date().toUTCString(), ports: [8080] },
  ];

  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .getEnvironmentReplicas(environment, replicas)
    .getTests()
    .stub(net.Server.prototype, 'listen', () => {})
    .stub(PortForward.prototype, 'portForward', () => { console.log('worked'); })
    .stdout()
    .command(['port-forward', '-a', account.name, '-e', environment.name])
    .it('port-forward command', ctx => {
      expect(ctx.stdout).to.include('Forwarding');
    });

  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .getEnvironmentReplicas(environment, replicas)
    .getTests()
    .stub(net.Server.prototype, 'listen', () => {})
    .stub(PortForward.prototype, 'portForward', () => { console.log('worked'); })
    .stdout()
    .command(['port-forward', '-a', account.name, '-e', environment.name, '-r', '0'])
    .it('port-forward component and replica of the form <replica-index> when there is only one service', ctx => {
      expect(ctx.stdout).to.include('Forwarding');
    });

    new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .getEnvironmentReplicas(environment, multiple_replicas)
    .getTests()
    .stdout()
    .command(['port-forward', '-a', account.name, '-e', environment.name, 'app', '-r', '2'])
    .catch(err => {
      expect(`${err}`).to.contain('Replica not found at index 2');
    })
    .it('port-forward component and replica failed indexing out-of-bound replica index');
});
