import { expect, test } from '@oclif/test';
import sinon from 'sinon';
import * as Docker from '../../src/common/utils/docker';

describe('login', () => {

  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

  test
    .timeout(20000)
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .stderr({ print })
    .command(['login', '-e', 'test-email'])
    .catch(ctx => {
      expect(ctx.message).to.contain('password is required')
    })
    .it('requires both email and password when not in a tty environment');

  test
    .timeout(20000)
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .stderr({ print })
    .command(['login'])
    .catch(ctx => {
      expect(ctx.message).to.contain('We detected that this environment does not have a prompt available. To login in a non-tty environment, please use both the user and password options: `architect login -e <email> -p <password>`')
    })
    .it('browser login flow throws when not in a tty environment');

});
