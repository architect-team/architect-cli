import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Register from '../../../src/commands/register';
import PortUtil from '../../../src/common/utils/port';
import { buildConfigFromYml, dumpToYml, Slugs } from '../../../src/dependency-manager/src';
import { loadAllTestSpecCombinations } from './partials/spec-test-harness';

describe('component spec unit test', function () {
  const all_spec_combinations = loadAllTestSpecCombinations();

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

  describe(`recursively test partial architect components`, async () => {

    it(`loadSourceYmlFromPathOrReject loads valid file`, async () => {
      const errors = [];
      for (const component of all_spec_combinations) {
        const source_yml = dumpToYml(component);
        buildConfigFromYml(source_yml, Slugs.DEFAULT_TAG);
      }
    });

  });

});
