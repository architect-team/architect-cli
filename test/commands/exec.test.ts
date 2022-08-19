import { expect, test } from '@oclif/test';
import { Replica } from '../../src/architect/environment/environment.utils';
import Exec from '../../src/commands/exec';
import { MOCK_API_HOST } from '../utils/mocks';

describe('exec', () => {
  const account = {
    name: 'examples',
    id: '1',
  };
  const environment = {
    name: 'test',
    id: '1',
  };
  const replicas: Replica[] = [{ ext_ref: 'ext', node_ref: 'node-ref', resource_ref: 'resource-ref', created_at: new Date().toUTCString() }];

  const defaults = test
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}`)
      .reply(200, account))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/environments/${environment.name}`)
      .reply(200, environment))
    .nock(MOCK_API_HOST, api => api
      .get(new RegExp(`/environments/${environment.id}/replicas.*`))
      .reply(200, replicas))
    .stub(Exec.prototype, 'exec', () => { console.log('worked'); });

  defaults
    .stdout()
    .command(['exec', '-a', account.name, '-e', environment.name, '--', 'ls', '-la'])
    .it('exec command with spaces', ctx => {
      expect(ctx.stdout).to.equal('worked\n');
    });

  defaults
    .stdout()
    .command(['exec', '-a', account.name, '-e', environment.name, 'examples/react-app', '--', 'ls', '-la'])
    .it('exec component and command with spaces', ctx => {
      expect(ctx.stdout).to.equal('worked\n');
    });

   test
    .command(['exec', '-a', account.name, '-e', environment.name, 'examples/react-app', 'ls'])
    .exit(2)
    .it('exec without -- fails');
});
