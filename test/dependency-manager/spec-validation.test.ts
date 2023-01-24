import { expect } from '@oclif/test';
import axios from 'axios';
import { buildSpecFromPath, parseSourceYml, resourceRefToNodeRef, ServiceNode } from '../../src';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { mock_components } from '../utils/mocks';

describe('superset spec validation', function () {
  describe('superset component', function () {
    it(`test/mocks/superset/architect.yml passes ajv json schema validation`, async () => {
      const component_spec = buildSpecFromPath(`test/mocks/superset/architect.yml`);
      const dependency_component_spec = buildSpecFromPath(mock_components.hello_world.CONFIG_FILE_PATH);
      const deprecated_component_spec = buildSpecFromPath(`test/mocks/superset/deprecated.architect.yml`);

      expect(component_spec.metadata.file?.path).to.equal(`test/mocks/superset/architect.yml`);
      expect(component_spec).to.not.be.undefined;

      const manager = new LocalDependencyManager(axios.create());
      await manager.getGraph([component_spec, dependency_component_spec, deprecated_component_spec], { '*': { param_unset: 'test' } });
    });

    it(`config interpolation works with multiline secrets`, async () => {
      const component_spec = buildSpecFromPath(`test/mocks/superset/architect.yml`);
      const dependency_component_spec = buildSpecFromPath(mock_components.hello_world.CONFIG_FILE_PATH);
      const deprecated_component_spec = buildSpecFromPath(`test/mocks/superset/deprecated.architect.yml`);

      const secrets_yml = `
        '*':
          param_unset: true
          param_string: |-
            {
              "multiline": "value"
            }`;

      const secrets_obj = parseSourceYml(secrets_yml) as any;

      const manager = new LocalDependencyManager(axios.create());
      const graph = await manager.getGraph([component_spec, dependency_component_spec, deprecated_component_spec], secrets_obj);

      const app_ref = resourceRefToNodeRef(`${component_spec.name}.services.stateless-app`);
      const app_node = graph.getNodeByRef(app_ref) as ServiceNode;

      expect(app_node.config.environment.PARAM_STRING).to.equal('{\n  "multiline": "value"\n}');
      expect(JSON.parse(app_node.config.environment.PARAM_STRING!)).to.deep.equal({
        'multiline': 'value',
      });
    });

    it(`config interpolation works with multiline secrets 2`, async () => {
      const component_spec = buildSpecFromPath(`test/mocks/superset/architect.yml`);
      const dependency_component_spec = buildSpecFromPath(mock_components.hello_world.CONFIG_FILE_PATH);
      const deprecated_component_spec = buildSpecFromPath(`test/mocks/superset/deprecated.architect.yml`);

      const secrets_yml = `
        '*':
          param_unset: true
          param_string: |-
            architect is great
            architect is still great`;

      const secrets_obj = parseSourceYml(secrets_yml) as any;

      const manager = new LocalDependencyManager(axios.create());
      const graph = await manager.getGraph([component_spec, dependency_component_spec, deprecated_component_spec], secrets_obj);

      const app_ref = resourceRefToNodeRef(`${component_spec.name}.services.stateless-app`);
      const app_node = graph.getNodeByRef(app_ref) as ServiceNode;

      expect(app_node.config.environment.PARAM_STRING).to.equal(secrets_obj['*'].param_string);
    });
  });
});
