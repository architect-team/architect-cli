import { expect } from '@oclif/test';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import path from 'path';
import sinon from 'sinon';
import Register from '../../../src/commands/register';
import PortUtil from '../../../src/common/utils/port';
import { buildConfigFromYml, loadSourceYmlFromPathOrReject, parseSourceYml, Slugs } from '../../../src/dependency-manager/src';

describe('component builder unit test', function () {
  beforeEach(async () => {

    // Stub the logger
    sinon.replace(Register.prototype, 'log', sinon.stub());
    moxios.install();
    moxios.wait(function () {
      let request = moxios.requests.mostRecent()
      if (request) {
        request.respondWith({
          status: 404,
        })
      }
    })

    sinon.replace(PortUtil, 'isPortAvailable', async () => true);
    PortUtil.reset();
  });

  afterEach(function () {
    // Restore stubs
    sinon.restore();
    // Restore fs
    mock_fs.restore();
    moxios.uninstall();
  });

  it(`loadSourceYmlFromPathOrReject loads valid file`, async () => {
    const { source_path, source_yml } = loadSourceYmlFromPathOrReject(`test/mocks/architect.yml`);

    expect(source_path).to.equal(`test/mocks/architect.yml`);
    expect(source_yml).to.contain('name: examples/superset');
  });

  it(`loadSourceYmlFromPathOrReject loads valid directory`, async () => {
    const { source_path, source_yml } = loadSourceYmlFromPathOrReject(`test/mocks`);

    expect(source_path).to.equal(`test${path.sep}mocks${path.sep}architect.yml`);
    expect(source_yml).to.contain('name: examples/superset');
  });

  it(`loadSourceYmlFromPathOrReject throws if given invalid directory`, async () => {
    expect(() => loadSourceYmlFromPathOrReject(`/non-existant/directory`)).to.throw('No component config file found at /non-existant/directory');
  });

  it(`parseSourceYml parses yaml into object with blank fields set to null`, async () => {
    const { source_path, source_yml } = loadSourceYmlFromPathOrReject(`test/mocks/architect.yml`);

    const parsed_yml = parseSourceYml(source_yml);

    expect((parsed_yml as any).name).to.equal('examples/superset');
    expect((parsed_yml as any).parameters.param_unset).to.be.null; // checks and makes sure we're properly parsing empty keys to 'null'
  });

  it(`buildConfigFromYml parses yaml and builds into config`, async () => {
    const { source_path, source_yml } = loadSourceYmlFromPathOrReject(`test/mocks/architect.yml`);

    const config = buildConfigFromYml(source_yml, Slugs.DEFAULT_TAG);

    expect(config.name).to.equal('examples/superset');
    expect(config.tag).to.equal(Slugs.DEFAULT_TAG);
  });

});
