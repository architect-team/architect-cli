import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { resourceRefToNodeRef, ServiceNode } from '../../src/dependency-manager/src';
import { parseString } from '../../src/dependency-manager/src/utils/parser';

describe('template', () => {
  it('ast test', async () => {

    const context = {
      'parameters.test': 5,
      'parameters.test2': '\${{ parameters.test + 5 }} == 10'
    }

    const program = `woot \${{ parameters.test2 }}`;

    const replaced_ast = parseString(program, context);

    console.log('-------------------------')

    console.log(JSON.stringify(replaced_ast, null, 2))
  });

  it('if statement', async () => {
    const component_config = `
    name: examples/hello-world
    parameters:
      environment: dev
      replicas: 1
    services:
      api:
        environment:
          NODE_ENV: production
          TEST: \${{ parameters['environment'] == 'dev' }}
          \${{ if (parameters.environment == 'local') }}:
            NODE_ENV: development
        replicas: \${{ parameters.replicas + 1 }}

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
    expect(node.config.replicas).to.eq(2);
    expect(node.config.environment).to.deep.eq({
      NODE_ENV: 'production'
    });
  });
});
