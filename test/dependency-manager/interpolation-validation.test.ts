import { expect } from 'chai';
import { buildSpecFromYml, ValidationErrors } from '../../src';
import ComponentRegister from '../../src/commands/register';

describe('interpolation-validation', () => {
  const registerInterpolation = ComponentRegister.registerInterpolation;

  const context = {
    architect: {
      build: {
        tag: 'latest'
      }
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
                \${{ if architect.environment == 'prod' }}:
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
            \${{ if architect.environment == 'prod' }}:
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
          \${{ if architect.environment == 'prod' }}:
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

    describe('local environment (edge case)', () => {
      it('can use conditional in build block if local', async () => {
        const component_config = `
        name: hello-world
        services:
          api:
            build:
              args:
                \${{ if architect.environment == 'local' }}:
                  ENV: local
        `

        const component_spec = buildSpecFromYml(component_config)
        registerInterpolation(component_spec, context)
      });

      it('can use conditional around build block if local', async () => {
        const component_config = `
        name: hello-world
        services:
          api:
            \${{ if architect.environment == 'local' }}:
              build:
                args:
                  ENV: local
        `

        const component_spec = buildSpecFromYml(component_config)
        registerInterpolation(component_spec, context)
      });

      it('can use conditional around service block with build block if local', async () => {
        const component_config = `
        name: hello-world
        services:
          \${{ if architect.environment == 'local' }}:
            api:
              build:
                args:
                  ENV: local
        `

        const component_spec = buildSpecFromYml(component_config)
        registerInterpolation(component_spec, context)
      });
    });

    it('can use tag conditional in build block', async () => {
      const component_config = `
        name: hello-world
        services:
          api:
            build:
              args:
                \${{ if architect.build.tag == 'latest' }}:
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
                TAG: \${{ architect.build.tag }}
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
