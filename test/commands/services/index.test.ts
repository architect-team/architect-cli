import { expect } from '@oclif/test';
import moxios from 'moxios';
import sinon from 'sinon';
import CredentialManager from '../../../src/app-config/credentials';
import Services from '../../../src/commands/services';

describe('services', () => {
  beforeEach(function () {
    sinon.replace(Services.prototype, 'log', sinon.stub());
    moxios.install();

    const credential_spy = sinon.fake.returns('token');
    sinon.replace(CredentialManager.prototype, 'get', credential_spy);
  });

  afterEach(function () {
    moxios.uninstall();
    sinon.restore();
  });

  it('lists all services', done => {
    moxios.stubRequest('/services', {
      status: 200,
      response: [],
    });

    moxios.wait(function () {
      let request = moxios.requests.mostRecent();
      expect(request.url).to.match(/.*\/services\?q=/);
      done();
    });

    Services.run([]);
  });

  it('supports search queries', done => {
    const search_term = 'architect';

    moxios.stubRequest('/services', {
      status: 200,
      response: [],
    });

    moxios.wait(function () {
      let request = moxios.requests.mostRecent();
      const match = request.url.match(/.*\/services\?q=(.*)/);
      expect(match).not.to.equal(null);
      expect(match!.length).to.be.greaterThan(1);
      expect(match![1]).to.equal(search_term);
      done();
    });

    Services.run([search_term]);
  });
});
