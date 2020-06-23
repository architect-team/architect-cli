/**
 * @format
 */
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Build from '../../src/commands/build';
import PortUtil from '../../src/common/utils/port';
import { ComponentConfigBuilder } from '../../src/dependency-manager/src/component-config/builder';

describe('validation spec v1', () => {
  beforeEach(async () => {
    // Stub the logger
    sinon.replace(Build.prototype, 'log', sinon.stub());
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

  describe('component validation', () => {
    it('valid service ref brackets', async () => {
      const component_config = `
      name: test/component
      services:
        stateless-app:
          interfaces:
            main: 8080
      interfaces:
        frontend: \${ services['stateless-app'].interfaces.main.url }
      `
      mock_fs({ '/architect.yml': component_config });
      await ComponentConfigBuilder.buildFromPath('/architect.yml')
    });

    it('invalid service ref', async () => {
      const component_config = `
      name: test/component
      services:
        stateless-app:
          interfaces:
            main: 8080
      interfaces:
        frontend: \${ services.fake.interfaces.main.url }
      `
      mock_fs({ '/architect.yml': component_config });
      let validation_err;
      try {
        await ComponentConfigBuilder.buildFromPath('/architect.yml')
      } catch (err) {
        validation_err = err;
      }
      // TODO: expect(validation_err).eq({})
    });
  })
});
