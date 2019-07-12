import { expect, test } from '@oclif/test';
import path from 'path';

const environment = {
  name: 'test',
  host: '0.0.0.0',
  namespace: 'test',
  service_token: 'test',
  cluster_ca_certificate: path.join(__dirname, 'create.test.ts')
};

describe('envs:create', () => {
  test
    .nock(process.env.API_HOST!, api => api
      .post('/environments')
      .reply(200, environment)
      .get(`/environments/${environment.name}/test`)
      .reply(200, [])
    )
    .stdout()
    .command([
      'envs:create', environment.name,
      '--host', environment.host,
      '--namespace', environment.namespace,
      '--service_token', environment.service_token,
      '--cluster_ca_certificate', environment.cluster_ca_certificate,
    ])
    .it('create environment', ctx => {
      const { stdout } = ctx;
      expect(stdout).to.contain('Creating Environment');
      expect(stdout).to.contain('Testing Environment');
    });
});
