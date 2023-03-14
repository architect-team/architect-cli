import { expect, test } from '@oclif/test';
import * as net from 'net';
import { Replica } from '../../src/architect/environment/environment.utils';
import PortForward from '../../src/commands/port-forward';
import { MOCK_API_HOST } from '../utils/mocks';

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

  const defaults = test
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}`)
      .reply(200, account))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/environments/${environment.name}`)
      .reply(200, environment))
    .nock(MOCK_API_HOST, api => api
      .get(new RegExp(`/environments/${environment.id}/replicas.*`))
      .optionally(true)
      .reply(200, replicas))
    .nock(MOCK_API_HOST, api => api
      .get(new RegExp(`/environments/${environment.id}/ws/port-forward.*`))
      .optionally(true)
      .reply(200))
    .stub(net.Server.prototype, 'listen', () => {})

  defaults
    .stub(PortForward.prototype, 'portForward', () => { console.log('worked'); })
    .stdout()
    .command(['port-forward', '-a', account.name, '-e', environment.name])
    .it('port-forward command', ctx => {
      expect(ctx.stdout).to.include('Forwarding');
    });

  defaults
    .stub(PortForward.prototype, 'portForward', () => { console.log('worked'); })
    .stdout()
    .command(['port-forward', '-a', account.name, '-e', environment.name, '-r', '0'])
    .it('port-forward component and replica of the form <replica-index> when there is only one service', ctx => {
      expect(ctx.stdout).to.include('Forwarding');
    });

  test
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}`)
      .reply(200, account))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/environments/${environment.name}`)
      .reply(200, environment))
    .nock(MOCK_API_HOST, api => api
      .get(new RegExp(`/environments/${environment.id}/replicas.*`))
      .reply(200, multiple_replicas))
    .stdout()
    .command(['port-forward', '-a', account.name, '-e', environment.name, 'app', '-r', '2'])
    .catch(err => {
      expect(`${err}`).to.contain('Replica not found at index 2');
    })
    .it('port-forward component and replica failed indexing out-of-bound replica index');
});
