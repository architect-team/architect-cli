import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { resourceRefToNodeRef, ServiceNode } from '../../src/dependency-manager/src';
import { parseString } from '../../src/dependency-manager/src/utils/parser';

describe('template', () => {
  it('divide parameters', async () => {
    const context = {
      'parameters.left': `6`,
      'parameters.right': `3`
    }
    const program = `\${{ parameters.left / parameters.right }}`;
    expect(parseString(program, context)).to.eq(2);
  });

  it('divide parameter with slash', async () => {
    const context = {
      'parameters.test/slash': `6`,
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

  it('if statement', async () => {
    const component_config = `
    name: examples/hello-world
    parameters:
      environment: local

    services:
      api:
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
  });
});
