import { buildConfigFromYml, dumpToYml, Slugs } from '../../../src/dependency-manager/src';
import { loadAllTestSpecCombinations } from './partials/spec-test-harness';

describe('component spec unit test', () => {
  const all_spec_combinations = loadAllTestSpecCombinations();

  it(`recursively test partial architect components`, () => {
    console.debug(`recursively testing ${all_spec_combinations.length} combined components...`);
    for (const component of all_spec_combinations) {
      const source_yml = dumpToYml(component);
      buildConfigFromYml(source_yml, Slugs.DEFAULT_TAG);
    }
  }).timeout(10000);

});
