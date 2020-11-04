import fs from 'fs-extra';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Register from '../../src/commands/register';
import PortUtil from '../../src/common/utils/port';
import { ComponentConfigBuilder } from '../../src/dependency-manager/src';

// This test validates the architect.yml file for each of our example components to ensure that none go out of date
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
    const EXAMPLES_DIR = 'examples';
    var example_architect_dirs = fs.readdirSync(EXAMPLES_DIR);

    for (const example_dir of example_architect_dirs) {
      if (fs.existsSync(`${EXAMPLES_DIR}/${example_dir}/architect.yml`)) {

        it(`${EXAMPLES_DIR}/${example_dir}/architect.yml passes validOrReject for the developer group`, async () => {
          const component_config = await ComponentConfigBuilder.buildFromPath(`${EXAMPLES_DIR}/${example_dir}/architect.yml`);

          try {
            await component_config.validateOrReject({ groups: ['developer'] });
          } catch (err) {
            console.log('An example architect file is failing the #validateOrReject() method', err);
            throw err;
          }
        });

      }
    }
  });
});
