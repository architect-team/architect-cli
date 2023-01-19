import { expect } from 'chai';
import { ArchitectError, buildSpecFromYml, validateBuild, validateInterpolation, ValidationErrors } from '../../src';

describe('interpolation-validation', () => {

  const context = {}

  describe('validate build block', () => {
    it('cannot use secret in build block', () => {
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
        validateInterpolation(component_spec)
      }).to.be.throws(ValidationErrors);
    });

    it('cannot use conditional in build block', () => {
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
        validateInterpolation(component_spec)
      }).to.be.throws(ValidationErrors);
    });

    it('cannot use conditional around build block', () => {
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
        validateInterpolation(component_spec)
      }).to.be.throws(ValidationErrors);
    });

    it('cannot use conditional around service block with build block', () => {
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
        validateInterpolation(component_spec)
      }).to.be.throws(ValidationErrors);
    });

    describe('local environment (edge case)', () => {
      it('can use conditional in build block if local', () => {
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
        validateInterpolation(component_spec)
      });

      it('can use conditional around build block if local', () => {
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
        validateInterpolation(component_spec)
      });

      it('can use conditional around service block with build block if local', () => {
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
        validateInterpolation(component_spec)
      });
    });

    it('cannot use tag conditional in build block', () => {
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
      expect(() => {
        validateInterpolation(component_spec)
      }).to.be.throws(ValidationErrors);
    });

    it('cannot use tag in build block', () => {
      const component_config = `
        name: hello-world
        services:
          api:
            build:
              args:
                TAG: \${{ architect.build.tag }}
        `

      const component_spec = buildSpecFromYml(component_config)
      expect(() => {
        validateInterpolation(component_spec)
      }).to.be.throws(ValidationErrors);
    });

    it('can use secret outside build block', () => {
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
      validateInterpolation(component_spec)
    });

    it('can still use conditional without build block', () => {
      const component_config = `
        name: hello-world
        services:
          api:
            \${{ if architect.environment == 'local' }}:
              environment:
                TEST: test
        `

      const component_spec = buildSpecFromYml(component_config)
      validateInterpolation(component_spec)
    });

    it('cannot use both dockerfile and buildpack in build block', () => {
      const component_config = `
        name: hello-world
        services:
          api:
            build:
              context: .
              dockerfile: Dockerfile
              buildpack: true
        `

      const component_spec = buildSpecFromYml(component_config)

      expect(() => {
        validateBuild(component_spec)
      }).to.be.throws(ArchitectError);
    });
  });
});
