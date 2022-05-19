import { expect } from 'chai';
import { buildSpecFromYml, ValidationErrors } from '../../src';
import { registerInterpolation } from '../../src/dependency-manager/utils/interpolation';

describe('interpolation-validation', () => {
  const context = {
    architect: {
      tag: 'latest'
    }
  }

  describe('validate build block', () => {
    it('cannot use secret in build block', async () => {
      const component_config = `
        name: hello-world
        secrets:
          environment: prod
        services:
          api:
            build:
              args:
                ENV: \${{ secrets.environment }}
        `

      const component_spec = buildSpecFromYml(component_config)

      expect(() => {
        registerInterpolation(component_spec, context)
      }).to.be.throws(ValidationErrors);
    });

    it('cannot use conditional in build block', async () => {
      const component_config = `
        name: hello-world
        services:
          api:
            build:
              args:
                \${{ if architect.environment == 'local' }}:
                  ENV: prod
        `

      const component_spec = buildSpecFromYml(component_config)

      expect(() => {
        registerInterpolation(component_spec, context)
      }).to.be.throws(ValidationErrors);
    });

    it('cannot use conditional around build block', async () => {
      const component_config = `
        name: hello-world
        services:
          api:
            \${{ if architect.environment == 'local' }}:
              build:
                args:
                  ENV: prod
        `

      const component_spec = buildSpecFromYml(component_config)

      expect(() => {
        registerInterpolation(component_spec, context)
      }).to.be.throws(ValidationErrors);
    });

    it('cannot use conditional around service block with build block', async () => {
      const component_config = `
        name: hello-world
        services:
          \${{ if architect.environment == 'local' }}:
            api:
              build:
                args:
                  ENV: prod
        `

      const component_spec = buildSpecFromYml(component_config)

      expect(() => {
        registerInterpolation(component_spec, context)
      }).to.be.throws(ValidationErrors);
    });

    it('can use tag conditional in build block', async () => {
      const component_config = `
        name: hello-world
        services:
          api:
            build:
              args:
                \${{ if architect.tag == 'latest' }}:
                  ENV: prod
        `

      const component_spec = buildSpecFromYml(component_config)
      registerInterpolation(component_spec, context)
    });

    it('can use tag in build block', async () => {
      const component_config = `
        name: hello-world
        services:
          api:
            build:
              args:
                TAG: \${{ architect.tag }}
        `

      const component_spec = buildSpecFromYml(component_config)
      registerInterpolation(component_spec, context)
    });

    it('can use secret outside build block', async () => {
      const component_config = `
        name: hello-world
        secrets:
          test:
            required: true
        services:
          api:
            environment:
              TEST: \${{ secrets.test }}
        `

      const component_spec = buildSpecFromYml(component_config)
      registerInterpolation(component_spec, context)
    });

    it('can still use conditional without build block', async () => {
      const component_config = `
        name: hello-world
        services:
          api:
            \${{ if architect.environment == 'local' }}:
              environment:
                TEST: test
        `

      const component_spec = buildSpecFromYml(component_config)
      registerInterpolation(component_spec, context)
    });
  });
});
