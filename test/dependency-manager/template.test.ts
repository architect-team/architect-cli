import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { resourceRefToNodeRef, ServiceNode } from '../../src/dependency-manager/src';
import { ArchitectParser } from '../../src/dependency-manager/src/utils/parser';

describe('template', () => {
  describe('operations', () => {
    it('base cases', async () => {
      const programs = {
        string: {
          input: '"test"',
          output: 'test'
        },
        boolean: {
          input: true,
          output: true
        },
        number: {
          input: 5,
          output: 5
        },
        unary!: {
          input: '!true',
          output: false
        },
        eq: {
          input: '5 == 5',
          output: true
        },
        neq: {
          input: '5 != 5',
          output: false
        },
        gt: {
          input: '5 > 5',
          output: false
        },
        gte: {
          input: '5 >= 5',
          output: true
        },
        lt: {
          input: '5 < 5',
          output: false
        },
        lte: {
          input: '5 <= 5',
          output: true
        },
        add: {
          input: '5 + 5',
          output: 10
        },
        sub: {
          input: '5 - 5',
          output: 0
        },
        div: {
          input: '5 / 5',
          output: 1
        },
        mul: {
          input: '5 * 5',
          output: 25
        },
        and: {
          input: 'true && false',
          output: false
        },
        or: {
          input: 'false || true',
          output: true
        }
      }

      const parser = new ArchitectParser();
      for (const [program_name, { input, output }] of Object.entries(programs)) {
        const program = `\${{ ${input} }}`
        expect(parser.parseString(program, {}), program_name).to.eq(output);
        expect(parser.errors).to.have.lengthOf(0);
      }
    });

    it('divide parameters', async () => {
      const context = {
        'parameters.left-2.num': 6,
        'parameters.right': 3
      }
      const program = `\${{ parameters.left-2.num / parameters.right }}`;
      const parser = new ArchitectParser();
      expect(parser.parseString(program, context)).to.eq(2);
      expect(parser.errors).to.have.lengthOf(0);
    });

    it('divide parameter with slash', async () => {
      const context = {
        'parameters.test/slash': 6,
      }
      const program = `\${{ parameters.test/slash / 3 }}`;
      const parser = new ArchitectParser();
      expect(parser.parseString(program, context)).to.eq(2);
      expect(parser.errors).to.have.lengthOf(0);
    });
  });

  describe('functions', () => {
    it('trim', async () => {
      const context = {
        'parameters.test': `  whitespace  `,
      }

      const base = `\${{ parameters.test }}`;
      const parser = new ArchitectParser();
      expect(parser.parseString(base, context)).to.eq('  whitespace  ');
      expect(parser.errors).to.have.lengthOf(0);

      const program = `\${{ 'no-' + trim(parameters.test) }}`;
      expect(parser.parseString(program, context)).to.eq('no-whitespace');
      expect(parser.errors).to.have.lengthOf(0);
    });
  });

  describe('statements', () => {
    it('nested if statements', async () => {
      const component_config = `
    name: examples/hello-world
    parameters:
      environment: local

    interfaces:
      \${{ if architect.environment == 'local' }}:
        api:
          url: \${{ services.api.interfaces.main.url }}
          ingress:
            enabled: true
      api2:
        url: \${{ services.api.interfaces.main.url }}

    services:
      \${{ if architect.environment == 'local' }}:
        api:
          interfaces:
            main: 8080
          \${{ if true }}:
            environment:
              NODE_ENV: production
              \${{ if (parameters.environment == 'local') }}:
                NODE_ENV: development
              \${{ if architect.environment == 'local' }}:
                LOCAL: 1
          \${{ if 1 }}:
            environment:
              TEST: 1
    `

      mock_fs({
        '/stack/architect.yml': component_config,
      });

      const manager = new LocalDependencyManager(axios.create(), {
        'examples/hello-world': '/stack/architect.yml',
      });
      const graph = await manager.getGraph([
        await manager.loadComponentSpec('examples/hello-world', { map_all_interfaces: true }),
      ]);
      const api_ref = resourceRefToNodeRef('examples/hello-world.services.api:latest');
      const node = graph.getNodeByRef(api_ref) as ServiceNode;
      expect(node.config.environment).to.deep.eq({
        LOCAL: '1',
        NODE_ENV: 'development',
        TEST: '1'
      });

      const graph2 = await manager.getGraph([
        await manager.loadComponentSpec('examples/hello-world'),
      ], { '*': { environment: 'prod' } });
      const node2 = graph2.getNodeByRef(api_ref) as ServiceNode;
      expect(node2.config.environment).to.deep.eq({
        LOCAL: '1',
        NODE_ENV: 'production',
        TEST: '1'
      });
    });

    it('if statements for host overrides', async () => {
      const component_config = `
    name: examples/hello-world
    parameters:
      environment: prod

    services:
      api-db:
        interfaces:
          main:
            port: 5432
            protocol: postgres
            \${{ if parameters.environment == 'prod' }}:
              port: 5432
              host: 'db.aws.com'
      api:
        interfaces:
          main: 8080
        environment:
          DB_HOST: \${{ services.api-db.interfaces.main.host }}
          DB_ADDR: \${{ services.api-db.interfaces.main.url }}
    `

      mock_fs({
        '/stack/architect.yml': component_config,
      });

      const manager = new LocalDependencyManager(axios.create(), {
        'examples/hello-world': '/stack/architect.yml',
      });
      const graph = await manager.getGraph([
        await manager.loadComponentSpec('examples/hello-world'),
      ]);
      const api_ref = resourceRefToNodeRef('examples/hello-world.services.api:latest');
      const api_node = graph.getNodeByRef(api_ref) as ServiceNode;
      expect(api_node.config.environment).to.deep.eq({
        DB_HOST: 'db.aws.com',
        DB_ADDR: 'postgres://db.aws.com:5432'
      });
    });

    it('if statements without interpolation', async () => {
      const component_config = `
    name: examples/hello-world

    interfaces:
      \${{ if architect.environment === 'local' }}:
        api: \${{ services.api.interfaces.main.url }}

    tasks:
      \${{ if architect.environment === 'local' }}:
        task:
          schedule: ''

    services:
      \${{ if architect.environment === 'local' }}:
        api:
          interfaces:
            main: 8080
    `

      mock_fs({
        '/stack/architect.yml': component_config,
      });

      const manager = new LocalDependencyManager(axios.create(), {
        'examples/hello-world': '/stack/architect.yml',
      });
      const graph = await manager.getGraph([
        await manager.loadComponentSpec('examples/hello-world'),
      ], undefined, false);
      expect(graph.nodes).lengthOf(0);
      expect(graph.edges).lengthOf(0);
    });
  });
});
