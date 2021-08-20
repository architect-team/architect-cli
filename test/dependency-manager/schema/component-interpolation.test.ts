import { expect } from '@oclif/test';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Register from '../../../src/commands/register';
import PortUtil from '../../../src/common/utils/port';
import { buildConfigFromPath, interpolateConfig, Slugs } from '../../../src/dependency-manager/src';

describe('component interpolation test', function () {
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

  describe('component interpolation', function () {

    it(`interpolates cors array as string`, async () => {
      const { component_config, source_path } = buildConfigFromPath(`test/mocks/cors/architect.yml`, Slugs.DEFAULT_TAG);
      expect(source_path).to.equal(`test/mocks/cors/architect.yml`);

      component_config.context = {
        ...component_config.context,
        ingresses: {
          main: {
            url: '',
            consumers: '[]'
          }
        }
      }
      const interpolated_config = interpolateConfig(component_config, []);
      expect(interpolated_config.errors).to.be.empty;
    });
  });
});
