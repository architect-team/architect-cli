import { expect, test } from '@oclif/test';


describe('login', () => {

  beforeEach(function () {

  });

  afterEach(function () {
  });

  it('requires both user and password when not in a tty environment', async () => {

    test
      .stderr()
      .command(['login', '-u', 'test-user'])
      .catch(ctx => {
        expect(ctx.message).to.contain('Error: password is required')
      });

  });

  it('browser login flow throws when not in a tty environment', async () => {

    test
      .stderr()
      .command(['login'])
      .catch(ctx => {
        expect(ctx.message).to.contain('We detected that this environment does not have a prompt available. To login in a non-tty environment, please use both the user and password options: `architect login -u <user> -p <password>`')
      });

  });
});
