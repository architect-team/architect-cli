import {expect} from '@oclif/test';
import sinon from 'sinon';
import moxios from 'moxios';
import Environments from '../../../src/commands/environments';

describe('environments', () => {
  beforeEach(function() {
    sinon.replace(Environments.prototype, 'log', sinon.stub());
    moxios.install();
  });

  afterEach(function() {
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
