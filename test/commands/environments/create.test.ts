import { expect, test } from '@oclif/test';
import path from 'path';
import { AppConfig } from '../../../src/app-config';

const app_config = new AppConfig();

const environment = {
  name: 'test',
  host: '0.0.0.0',
  namespace: 'test',
  service_token: 'test',
  cluster_ca_certificate: path.join(__dirname, 'create.test.ts')
};

describe('environment:create', () => {
  test
    .nock(app_config.api_host, api => api
      .post('/environments')
      .reply(200, environment)
    )
    .stdout()
    .command([
      'environment:create', environment.name,
      '--host', environment.host,
      '--namespace', environment.namespace,
      '--service_token', environment.service_token,
      '--cluster_ca_certificate', environment.cluster_ca_certificate
    ])
    .it('create environment', ctx => {
      const { stdout } = ctx;
      expect(stdout).to.contain('Creating Environment');
    });
});
