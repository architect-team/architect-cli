import { expect } from '@oclif/test';
import axios from 'axios';
import { resourceRefToNodeRef, ServiceNode } from '../../src';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { buildSpecFromPath, parseSourceYml } from '../../src/dependency-manager/spec/utils/component-builder';

describe('superset spec validation', function () {

  describe('superset component', function () {

    it(`test/mocks/superset/architect.yml passes ajv json schema validation`, async () => {
      const component_spec = buildSpecFromPath(`test/mocks/superset/architect.yml`);

      expect(component_spec.metadata.file?.path).to.equal(`test/mocks/superset/architect.yml`);
      expect(component_spec).to.not.be.undefined;

      const manager = new LocalDependencyManager(axios.create());
      await manager.getGraph([component_spec], { '*': { param_unset: 'test' } });
    });

    it(`config interpolation works with multiline secrets`, async () => {
      const component_spec = buildSpecFromPath(`test/mocks/superset/architect.yml`);
      const secrets_yml = `
        '*':
          param_unset: true
          param_string: |-
            {
              "multiline": "value"
            }`;

      const secrets_obj = parseSourceYml(secrets_yml) as any;

      const manager = new LocalDependencyManager(axios.create());
      const graph = await manager.getGraph([component_spec], secrets_obj);

      const db_ref = resourceRefToNodeRef(`${component_spec.name}.services.api-db`);
      const db_node = graph.getNodeByRef(db_ref) as ServiceNode;

      expect(db_node.config.environment.POSTGRES_USER).to.equal('{\n  "multiline": "value"\n}')
      expect(JSON.parse(db_node.config.environment.POSTGRES_USER!)).to.deep.equal({
        'multiline': 'value'
      })
    });

    it(`config interpolation works with multiline secrets 2`, async () => {
      const component_spec = buildSpecFromPath(`test/mocks/superset/architect.yml`);
      const secrets_yml = `
        '*':
          param_unset: true
          param_string: |-
            architect is great
            architect is still great`;

      const secrets_obj = parseSourceYml(secrets_yml) as any;

      const manager = new LocalDependencyManager(axios.create());
      const graph = await manager.getGraph([component_spec], secrets_obj);

      const db_ref = resourceRefToNodeRef(`${component_spec.name}.services.api-db`);
      const db_node = graph.getNodeByRef(db_ref) as ServiceNode;

      expect(db_node.config.environment.POSTGRES_USER).to.equal(secrets_obj['*'].param_string);
    });
  });
});
