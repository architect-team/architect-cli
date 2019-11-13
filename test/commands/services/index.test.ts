import {expect} from '@oclif/test';
import nock from 'nock';
import Service from '../../../src/commands/services';

describe('services', () => {
  before(function() {
    nock.recorder.rec({
      dont_print: true,
      output_objects: true,
    });
    nock.disableNetConnect();
    nock('https://api.architect.io')
      .get('/services?q=')
      .reply(200, []);
  });

  after(function() {
    nock.enableNetConnect();
  });

  beforeEach(function() {
    nock.recorder.clear();
  });

  it('lists all services', async () => {
    await Service.run([]);
    const recorded_calls = nock.recorder.play();
    expect(recorded_calls.length).to.equal(1);
    console.log((recorded_calls[0] as nock.Definition));
    expect((recorded_calls[0] as nock.Definition).path).to.equal('/services?q=');
  });

  it('supports search queries', async () => {
    const search_term = 'architect';
    await Service.run([search_term]);
    const recorded_calls = nock.recorder.play();
    expect(recorded_calls.length).to.equal(1);
    expect((recorded_calls[0] as nock.Definition).path).to.equal(`/services?q=${search_term}`);
  });
});
