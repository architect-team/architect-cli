import { expect, test } from '@oclif/test';


describe('login', () => {

  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

  test
    .timeout(10000)
    .stderr({ print })
    .command(['login', '-u', 'test-user'])
    .catch(ctx => {
      expect(ctx.message).to.contain('password is required')
    })
    .it('requires both user and password when not in a tty environment');

  test
    .stderr({ print })
    .command(['login'])
    .catch(ctx => {
      expect(ctx.message).to.contain('We detected that this environment does not have a prompt available. To login in a non-tty environment, please use both the user and password options: `architect login -u <user> -p <password>`')
    })
    .it('browser login flow throws when not in a tty environment');

});
