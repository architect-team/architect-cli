import { expect, test } from '@oclif/test';
import { Replica } from '../../src/architect/environment/environment.utils';
import Exec from '../../src/commands/exec';
import { MOCK_API_HOST } from '../utils/mocks';

describe('exec command', () => {
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
      .get(new RegExp(`/environments/${environment.id}/ws/exec.*`))
      .optionally(true)
      .reply(200));

  defaults
    .stub(Exec.prototype, 'exec', () => { console.log('worked'); })
    .stdout()
    .command(['exec', '-a', account.name, '-e', environment.name, '--', 'ls', '-la'])
    .it('exec command with spaces', ctx => {
      expect(ctx.stdout).to.equal('worked\n');
    });

  defaults
    .stub(Exec.prototype, 'exec', () => { console.log('worked'); })
    .stdout()
    .command(['exec', '-a', account.name, '-e', environment.name, 'examples/react-app', '--', 'ls', '-la'])
    .it('exec component and command with spaces', ctx => {
      expect(ctx.stdout).to.equal('worked\n');
    });

  defaults
    .stub(Exec.prototype, 'exec', () => { console.log('worked'); })
    .stdout()
    .command(['exec', '-a', account.name, '-e', environment.name, '-r', '0', '--', 'ls', '-la'])
    .it('exec component and replica of the form <replica-index> when there is only one service', ctx => {
      expect(ctx.stdout).to.equal('worked\n');
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
