import { expect } from '@oclif/test';
import fs from 'fs-extra';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Register from '../../src/commands/register';
import PortUtil from '../../src/common/utils/port';
import { buildConfigFromPath, Slugs } from '../../src/dependency-manager/src';

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

        it(`${EXAMPLES_DIR}/${example_dir}/architect.yml passes ajv json schema validation`, async () => {
          const { component_config, source_path } = await buildConfigFromPath(`${EXAMPLES_DIR}/${example_dir}/architect.yml`, Slugs.DEFAULT_TAG);

          expect(source_path).to.equal(`${EXAMPLES_DIR}/${example_dir}/architect.yml`);
          expect(component_config).to.not.be.undefined;
        });
      } else {
        // if there's no architect.yml in the top-level examples dir, check one level deeper
        var second_level_dirs = fs.readdirSync(`${EXAMPLES_DIR}/${example_dir}`);

        for (const second_level_dir of second_level_dirs) {
          if (fs.existsSync(`${EXAMPLES_DIR}/${example_dir}/${second_level_dir}/architect.yml`)) {

            it(`${EXAMPLES_DIR}/${example_dir}/${second_level_dir}/architect.yml passes ajv json schema validation`, async () => {
              const { component_config, source_path } = await buildConfigFromPath(`${EXAMPLES_DIR}/${example_dir}/${second_level_dir}/architect.yml`, Slugs.DEFAULT_TAG);

              expect(source_path).to.equal(`${EXAMPLES_DIR}/${example_dir}/${second_level_dir}/architect.yml`);
              expect(component_config).to.not.be.undefined;
            });
          }
        }
      }
    }
  });
});
