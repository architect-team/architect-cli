import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Register from '../../src/commands/register';
import PortUtil from '../../src/common/utils/port';
import { ComponentConfigBuilder } from '../../src/dependency-manager/src';

// This test validates the architect.yml file for each of our example components to ensure that none go out of date
// TODO:84: add validation for all the other example architect.ymls
describe('example component validation', function () {
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
    it('passes validOrReject for the developer group', async () => {
      const component_config = await ComponentConfigBuilder.buildFromPath('examples/basic-task/architect.yml');

      try {
        await component_config.validateOrReject({ groups: ['developer'] });
      } catch (err) {
        console.log(err);
      }
    });
  });
});
