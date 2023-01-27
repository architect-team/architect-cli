import { expect } from '@oclif/test';
import fs from 'fs-extra';
import { buildConfigFromPath } from '../../src';
import { EXAMPLE_PROJECT_PATHS } from '../utils/mocks';

// This test validates the architect.yml file for each of our example components to ensure that none go out of date
describe('example component validation', function () {

  describe('example components', function () {
    for (const example_project_path of Object.values(EXAMPLE_PROJECT_PATHS)) {
      if (fs.existsSync(example_project_path)) {
        it(`${example_project_path} passes ajv json schema validation`, async () => {
          const component_config = buildConfigFromPath(example_project_path);

          expect(component_config.metadata.file?.path).to.equal(example_project_path);
          expect(component_config).to.not.be.undefined;
        });

      }
    }
  });
});
