import { expect } from '@oclif/test';
import fs from 'fs-extra';
import { buildConfigFromPath } from '../../src';

// This test validates the architect.yml file for each of our example components to ensure that none go out of date
describe('example component validation', function () {

  describe('example components', function () {
    const EXAMPLES_DIR = 'examples';
    var example_architect_dirs = fs.readdirSync(EXAMPLES_DIR);

    for (const example_dir of example_architect_dirs) {
      if (fs.existsSync(`${EXAMPLES_DIR}/${example_dir}/architect.yml`)) {

        it(`${EXAMPLES_DIR}/${example_dir}/architect.yml passes ajv json schema validation`, async () => {
          const component_config = buildConfigFromPath(`${EXAMPLES_DIR}/${example_dir}/architect.yml`);

          expect(component_config.metadata.file?.path).to.equal(`${EXAMPLES_DIR}/${example_dir}/architect.yml`);
          expect(component_config).to.not.be.undefined;
        });

      }
    }
  });
});
