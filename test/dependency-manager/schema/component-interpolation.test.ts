import { expect } from '@oclif/test';
import { buildConfigFromPath, interpolateConfig, Slugs } from '../../../src/dependency-manager/src';

describe('component interpolation test', function () {

  describe('component interpolation', function () {

    it(`interpolates cors array as string`, async () => {
      const { component_config, source_path } = buildConfigFromPath(`test/mocks/cors/architect.yml`, Slugs.DEFAULT_TAG);
      expect(source_path).to.equal(`test/mocks/cors/architect.yml`);

      component_config.context = {
        ...component_config.context,
        ingresses: {
          main: {
            url: '',
            consumers: []
          }
        }
      }
      const interpolated_config = interpolateConfig(component_config, []);
      expect(interpolated_config.errors).to.be.empty;
    });
  });
});
