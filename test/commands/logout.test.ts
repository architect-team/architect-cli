import {expect, test} from '@oclif/test';
import sinon from 'sinon';
import Logout from '../../src/commands/logout';
import CredentialManager from '../../src/app-config/credentials';

describe('logout', () => {
  beforeEach(function() {
    sinon.replace(Logout.prototype, 'log', sinon.stub());
  });

  afterEach(function() {
    sinon.restore();
  });

  it('deletes local credentials', async () => {
    const credential_spy = sinon.fake.returns(null);
    sinon.replace(CredentialManager.prototype, 'delete', credential_spy);

    await Logout.run();
    expect(credential_spy.getCalls().length).to.equal(2);
    expect(credential_spy.firstCall.args[0]).to.equal('architect.io');
    expect(credential_spy.secondCall.args[0]).to.equal('architect.io/token');
  });
})
