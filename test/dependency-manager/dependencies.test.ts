import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import { resourceRefToNodeRef, ServiceNode } from '../../src';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';

describe('dependencies', () => {

  it('circular dependencies', async () => {
    const cloud_config = `
      name: cloud
      dependencies:
        server: latest
      services:
        app:
          interfaces:
            main: 8080
          environment:
            SERVER_ADDR: \${{ dependencies.server.interfaces.server.url }}
            SERVER_EXT_ADDR: \${{ dependencies.server.ingresses.server.url }}
      interfaces:
        app:
          url: \${{ services.app.interfaces.main.url }}
          ingress:
            subdomain: app
    `;

    const server_config = `
      name: server
      dependencies:
        cloud: latest
      services:
        server:
          interfaces:
            main: 8080
          environment:
            CLOUD_ADDR: \${{ dependencies.cloud.interfaces.app.url }}
            CLOUD_EXT_ADDR: \${{ dependencies.cloud.ingresses.app.url }}
      interfaces:
        server:
          url: \${{ services.server.interfaces.main.url }}
          ingress:
            subdomain: server
    `;

    mock_fs({
      '/stack/cloud/architect.yml': cloud_config,
      '/stack/server/architect.yml': server_config,
    });
    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'cloud': '/stack/cloud/architect.yml',
      'server': '/stack/server/architect.yml'
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('cloud:latest'),
      await manager.loadComponentSpec('server:latest')
    ]);

    const app_ref = resourceRefToNodeRef('cloud.services.app');
    const server_ref = resourceRefToNodeRef('server.services.server');

    const app = graph.getNodeByRef(app_ref) as ServiceNode;
    expect(app.config.environment).to.deep.equal({
      SERVER_ADDR: `http://${server_ref}:8080`,
      SERVER_EXT_ADDR: `http://server.arc.localhost`
    })

    const server = graph.getNodeByRef(server_ref) as ServiceNode;
    expect(server.config.environment).to.deep.equal({
      CLOUD_ADDR: `http://${app_ref}:8080`,
      CLOUD_EXT_ADDR: `http://app.arc.localhost`
    })
  });
});
