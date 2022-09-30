import { expect, test } from '@oclif/test';
import sinon from 'sinon';
import CredentialManager from '../../src/app-config/credentials';
import * as Docker from '../../src/common/docker/cmd';

describe('logout', () => {
  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

  describe('deletes local credentials', () => {
    const credential_spy = sinon.fake.returns(null);

    test
      .timeout(20000)
      .stub(Docker, 'docker', sinon.fake.returns(null))
      .stub(CredentialManager.prototype, 'delete', credential_spy)
      .stderr({ print })
      .command(['logout'])
      .it('delete is called with expected params', () => {
        expect(credential_spy.getCalls().length).to.equal(1);
        expect(credential_spy.firstCall.args[0]).to.equal('architect.io/token');
      });
  });
});
