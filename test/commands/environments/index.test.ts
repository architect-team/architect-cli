import { expect, test } from '@oclif/test';

import { AppConfig } from '../../../src/app-config';
const app_config = new AppConfig();

const environment = {
  name: 'test',
  host: '0.0.0.0',
  namespace: 'test',
  service_token: 'test',
};

describe('environments:list', () => {
  test
    .nock(app_config.api_host, api => api
      .get('/environments')
      .reply(200, [environment])
    )
    .stdout()
    .command(['environments:list'])
    .it('list environments', ctx => {
      const { stdout } = ctx;
      expect(stdout).to.contain(JSON.stringify([environment], null, 2));
    });
});
