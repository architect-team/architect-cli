import { expect } from '@oclif/test';
import { buildConfigFromPath, parseSourceYml, Slugs, transformComponentSpec, validateOrRejectSpec } from '../../src/dependency-manager/src';
import { interpolateStringOrReject } from '../../src/dependency-manager/src/utils/interpolation';

describe('superset spec validation', function () {

  describe('superset component', function () {

    it(`test/mocks/superset/architect.yml passes ajv json schema validation`, async () => {
      const { component_config, source_path } = buildConfigFromPath(`test/mocks/superset/architect.yml`, Slugs.DEFAULT_TAG);

      expect(source_path).to.equal(`test/mocks/superset/architect.yml`);
      expect(component_config).to.not.be.undefined;
    });

    it(`config interpolation works with multiline parameters`, async () => {
      const { component_config, source_path } = buildConfigFromPath(`test/mocks/superset/architect.yml`, Slugs.DEFAULT_TAG);
      const values_yml = `
        param_string: |-
          {
            "multiline": "value"
          }`;

      const values_obj = parseSourceYml(values_yml) as any;
      component_config.context.parameters = {
        ...component_config.context.parameters,
        ...values_obj
      }

      component_config.context.services['stateless-api'].interfaces.main.url = 'test'
      component_config.context.services['frontend'].interfaces.web.url = 'test'

      const interpolated_component_string = interpolateStringOrReject(component_config.source_yml, component_config.context, []).replace(/__arc__{{/g, '${{');
      const parsed_yml = parseSourceYml(interpolated_component_string);
      const spec = validateOrRejectSpec(parsed_yml);
      const interpolated_component_config = transformComponentSpec(spec, interpolated_component_string, component_config.tag, component_config.instance_metadata);
      expect(interpolated_component_config.services['api-db'].environment.POSTGRES_USER).to.equal('{\n  "multiline": "value"\n}')
      expect(JSON.parse(interpolated_component_config.services['api-db'].environment.POSTGRES_USER!)).to.deep.equal({
        'multiline': 'value'
      })
    });

    it(`config interpolation works with multiline parameters 2`, async () => {
      const { component_config, source_path } = buildConfigFromPath(`test/mocks/superset/architect.yml`, Slugs.DEFAULT_TAG);
      const values_yml = `
        param_string: |-
          architect is great
          architect is still great`;

      const values_obj = parseSourceYml(values_yml) as any;
      component_config.context.parameters = {
        ...component_config.context.parameters,
        ...values_obj,
      }

      component_config.context.services['stateless-api'].interfaces.main.url = 'test'
      component_config.context.services['frontend'].interfaces.web.url = 'test'

      const interpolated_component_string = interpolateStringOrReject(component_config.source_yml, component_config.context, []).replace(/__arc__{{/g, '${{');
      const parsed_yml = parseSourceYml(interpolated_component_string);
      const spec = validateOrRejectSpec(parsed_yml);
      const interpolated_component_config = transformComponentSpec(spec, interpolated_component_string, component_config.tag, component_config.instance_metadata);

      expect(interpolated_component_config.services['api-db'].environment.POSTGRES_USER).to.equal(values_obj.param_string)
    });

  });
});
