import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { resourceRefToNodeRef, ServiceNode } from '../../src/dependency-manager/src';
import { parseString } from '../../src/dependency-manager/src/utils/parser';

describe('template', () => {
  it('divide parameters', async () => {
    const context = {
      'parameters.left-2.num': 6,
      'parameters.right': 3
    }
    const program = `\${{ parameters.left-2.num / parameters.right }}`;
    expect(parseString(program, context)).to.eq(2);
  });

  it('divide parameter with slash', async () => {
    const context = {
      'parameters.test/slash': 6,
    }
    const program = `\${{ parameters.test/slash / 3 }}`;
    expect(parseString(program, context)).to.eq(2);
  });

  it('trim function', async () => {
    const context = {
      'parameters.test': `  whitespace  `,
    }

    const base = `\${{ parameters.test }}`;
    expect(parseString(base, context)).to.eq('  whitespace  ');

    const program = `\${{ 'no-' + trim(parameters.test) }}`;
    expect(parseString(program, context)).to.eq('no-whitespace');
  });

  it('if statements', async () => {
    const component_config = `
    name: examples/hello-world
    parameters:
      environment: local

    services:
      api:
        \${{ if true }}:
          environment:
            NODE_ENV: production
            \${{ if (parameters.environment == 'local') }}:
              NODE_ENV: development
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('examples/hello-world'),
    ]);
    const api_ref = resourceRefToNodeRef('examples/hello-world/api:latest');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.config.environment).to.deep.eq({
      NODE_ENV: 'development'
    });

    const graph2 = await manager.getGraph([
      await manager.loadComponentConfig('examples/hello-world'),
    ], { '*': { environment: 'prod' } });
    const node2 = graph2.getNodeByRef(api_ref) as ServiceNode;
    expect(node2.config.environment).to.deep.eq({
      NODE_ENV: 'production'
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
          CORS: \${{ ingresses.api.consumers }}

      app:
        interfaces:
          main: 8080
        environment:
          APP_ADDR: \${{ ingresses.app.url }}
          API_ADDR: \${{ ingresses.api.url }}

    interfaces:
      api: \${{ services.api.interfaces.main.url }}
      app: \${{ services.app.interfaces.main.url }}
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('examples/hello-world'),
    ]);
    const api_ref = resourceRefToNodeRef('examples/hello-world/api:latest');
    const api_node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(api_node.config.environment).to.deep.eq({
      DB_HOST: 'db.aws.com',
      DB_ADDR: 'postgres://db.aws.com:5432'
    });

    const app_ref = resourceRefToNodeRef('examples/hello-world/app:latest');
    const app_node = graph.getNodeByRef(app_ref) as ServiceNode;
    expect(app_node.config.environment).to.deep.eq({
      API_ADDR: 'http://api.arc.localhost',
    });
  });
});
