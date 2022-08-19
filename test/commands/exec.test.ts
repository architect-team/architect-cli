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
  const replicas: Replica[] = [{ ext_ref: 'ext', node_ref: 'node-ref', resource_ref: 'my-app.services.app', created_at: new Date().toUTCString() }];

  const defaults = test
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}`)
      .reply(200, account))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.id}/environments/${environment.name}`)
      .reply(200, environment))
    .nock(MOCK_API_HOST, api => api
      .get(new RegExp(`/environments/${environment.id}/replicas.*`))
      .reply(200, replicas));

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
  
  defaults
    .stdout()
    .command(['exec', '-a', account.name, '-e', environment.name, '-r', 'app', '--', 'ls', '-la'])
    .catch(err => {
      expect(`${err}`).to.contain('Replica must be of the form <service-name>:<replica-index> or <replica-index>.');
    })
    .it('exec component and replica failed with incorrect format');
  
  defaults
    .stdout()
    .command(['exec', '-a', account.name, '-e', environment.name, '-r', 'app:', '--', 'ls', '-la'])
    .catch(err => {
      expect(`${err}`).to.contain('Replica must be of the form <service-name>:<replica-index> or <replica-index>.');
    })
    .it('exec component and replica failed with missing replica index');

  defaults
    .stub(Exec.prototype, 'exec', () => { console.log('worked'); })
    .stdout()
    .command(['exec', '-a', account.name, '-e', environment.name, '-r', 'app:0', '--', 'ls', '-la'])
    .it('exec component and replica of the form <service-name>:<replica-index>', ctx => {
      expect(ctx.stdout).to.equal('worked\n');
    });
  
  defaults
    .stdout()
    .command(['exec', '-a', account.name, '-e', environment.name, '-r', 'app:1', '--', 'ls', '-la'])
    .catch(err => {
      expect(`${err}`).to.contain('No replica found at index 1');
    })
    .it('exec component and replica failed indexing out-of-bound replica index');
  
  defaults
    .stdout()
    .command(['exec', '-a', account.name, '-e', environment.name, '-r', ':1', '--', 'ls', '-la'])
    .catch(err => {
      expect(`${err}`).to.contain('No service name found');
    })
    .it('exec component and replica failed with missing service name');
  
  test
    .command(['exec', '-a', account.name, '-e', environment.name, 'examples/react-app', 'ls'])
    .exit(2)
    .it('exec without -- fails');
});
