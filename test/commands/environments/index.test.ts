import { expect } from '@oclif/test';
import moxios from 'moxios';
import sinon from 'sinon';
import CredentialManager from '../../../src/app-config/credentials';
import Environments from '../../../src/commands/environments';

describe('environments', () => {
  beforeEach(function () {
    sinon.replace(Environments.prototype, 'log', sinon.stub());
    moxios.install();

    const credential_spy = sinon.fake.returns('token');
    sinon.replace(CredentialManager.prototype, 'get', credential_spy);
  });

  afterEach(function () {
    moxios.uninstall();
    sinon.restore();
  });

  it('lists all environments', done => {
    moxios.stubRequest('/environments', {
      status: 200,
      response: [],
    });

    moxios.wait(function () {
      let request = moxios.requests.mostRecent();
      expect(request.url).to.match(/.*\/environments\?q=/);
      done();
    });

    Environments.run([]);
  });

  it('supports search queries', done => {
    const search_term = 'architect';

    moxios.stubRequest('/environments', {
      status: 200,
      response: [],
    });

    moxios.wait(function () {
      let request = moxios.requests.mostRecent();
      const match = request.url.match(/.*\/environments\?q=(.*)/);
      expect(match).not.to.equal(null);
      expect(match!.length).to.be.greaterThan(1);
      expect(match![1]).to.equal(search_term);
      done();
    });

    Environments.run([search_term]);
  });
})
