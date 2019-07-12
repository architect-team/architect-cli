import { expect, test } from '@oclif/test';

describe('list', () => {
  test
    .nock(process.env.API_HOST!, api => api
      .get('/environments')
      .reply(200, [])
    )
    .stdout()
    .timeout(10000)
    .command(['envs:list'])
    .it('list environments', ctx => {
      const { stdout } = ctx;
      expect(stdout).to.contain([]);
    });
});
