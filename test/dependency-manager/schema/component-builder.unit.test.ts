import { expect } from '@oclif/test';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import path from 'path';
import sinon from 'sinon';
import Register from '../../../src/commands/register';
import PortUtil from '../../../src/common/utils/port';
import { buildConfigFromYml, loadSpecFromPathOrReject, parseSourceYml, Slugs } from '../../../src/dependency-manager/src';

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

  it(`loadSpecFromPathOrReject loads valid file`, async () => {
    const { file_path, file_contents } = loadSpecFromPathOrReject(`test/mocks/architect.yml`);

    expect(file_path).to.equal(`test/mocks/architect.yml`);
    expect(file_contents).to.contain('name: examples/superset');
  });

  it(`loadSpecFromPathOrReject loads valid directory`, async () => {
    const { file_path, file_contents } = loadSpecFromPathOrReject(`test/mocks`);

    expect(file_path).to.equal(`test${path.sep}mocks${path.sep}architect.yml`);
    expect(file_contents).to.contain('name: examples/superset');
  });

  it(`loadSpecFromPathOrReject throws if given invalid directory`, async () => {
    expect(() => loadSpecFromPathOrReject(`/non-existant/directory`)).to.throw('No component config file found at /non-existant/directory');
  });

  it(`parseSourceYml parses yaml into object with blank fields set to null`, async () => {
    const { file_path, file_contents } = loadSpecFromPathOrReject(`test/mocks/architect.yml`);

    const parsed_yml = parseSourceYml(file_contents);

    expect((parsed_yml as any).name).to.equal('examples/superset');
    expect((parsed_yml as any).parameters.param_unset).to.be.null; // checks and makes sure we're properly parsing empty keys to 'null'
  });

  it(`buildConfigFromYml parses yaml and builds into config`, async () => {
    const { file_path, file_contents } = loadSpecFromPathOrReject(`test/mocks/architect.yml`);

    const config = buildConfigFromYml(file_contents, Slugs.DEFAULT_TAG);

    expect(config.name).to.equal('examples/superset');
    expect(config.tag).to.equal(Slugs.DEFAULT_TAG);
  });

});
