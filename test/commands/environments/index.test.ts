import { expect, test } from '@oclif/test';

const environment = {
  name: 'test',
  host: '0.0.0.0',
  namespace: 'test',
  service_token: 'test',
};

describe('environments:list', () => {
  test
    .nock(process.env.API_HOST!, api => api
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
