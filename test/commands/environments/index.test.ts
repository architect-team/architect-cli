import { expect, test } from '@oclif/test';

const environment = {
  name: 'test',
  host: '0.0.0.0',
  namespace: 'test',
  service_token: 'test',
};

describe('envs:list', () => {
  test
    .nock(process.env.API_HOST!, api => api
      .get('/environments')
      .reply(200, [environment])
    )
    .stdout()
    .command(['envs:list'])
    .it('list environments', ctx => {
      const { stdout } = ctx;
      expect(stdout).to.contain(JSON.stringify([environment], null, 2));
    });
});
