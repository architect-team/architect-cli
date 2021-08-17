import { expect } from '@oclif/test';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Register from '../../src/commands/register';
import PortUtil from '../../src/common/utils/port';
import { buildConfigFromPath, Slugs } from '../../src/dependency-manager/src';

describe('superset spec validation', function () {
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

  describe('example components', function () {

    it(`test/mocks/architect.yml passes ajv json schema validation`, async () => {
      const { component_config, source_path } = buildConfigFromPath(`test/mocks/architect.yml`, Slugs.DEFAULT_TAG);

      expect(source_path).to.equal(`test/mocks/architect.yml`);
      expect(component_config).to.not.be.undefined;
    });

  });
});
