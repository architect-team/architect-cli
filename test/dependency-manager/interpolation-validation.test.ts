import { expect } from 'chai';
import { buildSpecFromYml, DependencyEdge, DependencyGraphMutable, DependencyNode, ServiceNode, TaskNode, validateInterpolation, ValidationErrors } from '../../src';

describe('interpolation-validation', () => {
  const mock_graph: Readonly<DependencyGraphMutable> = {
    nodes: [
      {
        instance_id: '',
        __type: 'service',
        ref: 'hello-world--api',
        component_ref: 'hello-world',
        service_name: 'api',
        artifact_image: undefined,
      } as ServiceNode,
    ],
    edges: [],
    validated: false,
    nodes_map: {} as Map<string, DependencyNode>,
    edges_map: {} as Map<string, DependencyEdge>,
    addNode: function (node: DependencyNode): DependencyNode {
      throw new Error('Function not implemented.');
    },
    removeNodeByRef: function (ref: string): void {
      throw new Error('Function not implemented.');
    },
    removeEdgeByRef: function (edge_ref: string): void {
      throw new Error('Function not implemented.');
    },
    addEdge: function (edge: DependencyEdge): DependencyEdge {
      throw new Error('Function not implemented.');
    },
    getNodeByRef: function (ref: string): DependencyNode {
      throw new Error('Function not implemented.');
    },
    getDownstreamNodes: function (node: DependencyNode): DependencyNode[] {
      throw new Error('Function not implemented.');
    },
    removeNode: function (node_ref: string, cleanup_dangling: boolean): void {
      throw new Error('Function not implemented.');
    },
    getUpstreamNodes: function (node: DependencyNode): DependencyNode[] {
      throw new Error('Function not implemented.');
    },
    getDependsOn: function (current_node: ServiceNode | TaskNode): (ServiceNode | TaskNode)[] {
      throw new Error('Function not implemented.');
    },
  };

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
        validateInterpolation(component_spec, {} as Readonly<DependencyGraphMutable>);
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
        validateInterpolation(component_spec, {} as Readonly<DependencyGraphMutable>);
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
        validateInterpolation(component_spec, {} as Readonly<DependencyGraphMutable>);
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
        validateInterpolation(component_spec, {} as Readonly<DependencyGraphMutable>);
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
        `;

        const component_spec = buildSpecFromYml(component_config);
        validateInterpolation(component_spec, mock_graph);
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
        `;

        const component_spec = buildSpecFromYml(component_config);
        validateInterpolation(component_spec, mock_graph);
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
        `;

        const component_spec = buildSpecFromYml(component_config);
        validateInterpolation(component_spec, mock_graph);
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
        `;

      const component_spec = buildSpecFromYml(component_config);
      expect(() => {
        validateInterpolation(component_spec, {} as Readonly<DependencyGraphMutable>);
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
        `;

      const component_spec = buildSpecFromYml(component_config);
      expect(() => {
        validateInterpolation(component_spec, {} as Readonly<DependencyGraphMutable>);
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
        `;

      const component_spec = buildSpecFromYml(component_config);
      validateInterpolation(component_spec, {} as Readonly<DependencyGraphMutable>);
    });

    it('can still use conditional without build block', () => {
      const component_config = `
        name: hello-world
        services:
          api:
            \${{ if architect.environment == 'local' }}:
              environment:
                TEST: test
        `;

      const component_spec = buildSpecFromYml(component_config);
      validateInterpolation(component_spec, {} as Readonly<DependencyGraphMutable>);
    });

    it('fail when using interpolation where path does not exist', () => {
      const component_config = `
        name: hello-world
        services:
          api:
            build:
              context: .
            environment:
              DB_ADDR: \${{ services.database.interfaces.main.url }}
        `;

      const component_spec = buildSpecFromYml(component_config);

      expect(() => {
        validateInterpolation(component_spec, mock_graph);
      }).to.be.throws(ValidationErrors);
    });

    it('fail when secret does not exist', () => {
      const component_config = `
        name: hello-world
        secrets:
          world_text:
            default: World
        services:
          api:
            build:
              context: .
            environment:
              WORLD_TEXT: \${{ secrets.notfound }}
        `;

      const component_spec = buildSpecFromYml(component_config);

      expect(() => {
        validateInterpolation(component_spec, {} as Readonly<DependencyGraphMutable>);
      }).to.be.throws(ValidationErrors);
    });
  });
});
