import {expect} from '@oclif/test';
import sinon from 'sinon';
import moxios from 'moxios';
import Services from '../../../src/commands/services';

describe('services', () => {
  beforeEach(function() {
    sinon.replace(Services.prototype, 'log', sinon.stub());
    moxios.install();
  });

  afterEach(function() {
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
      request.respondWith({
        status: 200,
        response: [
          { name: 'test/service', updated_at: 'test', created_at: 'test' },
        ],
      });

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
      request.respondWith({
        status: 200,
        response: [
          { name: `${search_term}/service`, updated_at: 'test', created_at: 'test' },
        ],
      });

      const match = request.url.match(/.*\/services\?q=(.*)/);
      expect(match).not.to.equal(null);
      expect(match!.length).to.be.greaterThan(1);
      expect(match![1]).to.equal(search_term);
      done();
    });

    Services.run([search_term]);
  });
});
