import axios from 'axios';
import { expect } from 'chai';
import yaml from 'js-yaml';
import mock_fs from 'mock-fs';
import nock from 'nock';
import { resourceRefToNodeRef, ServiceNode } from '../../src';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';

describe('debug spec v1', () => {
  it('debug block does apply for local component', async () => {
    const component_config = `
    name: examples/hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        command:
          - bash
          - -c
          - echo "prod"
        environment:
          NODE_ENV: production
        debug:
          command:
            - bash
            - -c
            - echo "debug"
          environment:
            NODE_ENV: development

    interfaces:
      echo:
        url: \${{ services.api.interfaces.main.url }}
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
    const api_ref = resourceRefToNodeRef('examples/hello-world.services.api');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.config.command).to.deep.eq(['bash', '-c', 'echo "debug"'])
    expect(node.config.environment).to.deep.eq({
      NODE_ENV: 'development'
    });
  });

  it('debug block does not apply for remote component', async () => {
    const component_config = `
    name: examples/hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          NODE_ENV: production
        debug:
          environment:
            NODE_ENV: development

    interfaces:
      echo:
        url: \${{ services.api.interfaces.main.url }}
    `

    nock('http://localhost').get('/accounts/examples/components/hello-world/versions/latest')
      .reply(200, { tag: 'latest', config: yaml.load(component_config), service: { url: 'examples/hello-world:latest' } });

    const manager = new LocalDependencyManager(axios.create());
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('examples/hello-world'),
    ]);
    const api_ref = resourceRefToNodeRef('examples/hello-world.services.api');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.config.environment).to.deep.eq({
      NODE_ENV: 'production'
    });
  });
});
