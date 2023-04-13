import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import { buildSpecFromYml, resourceRefToNodeRef, ServiceNode, ValidationErrors } from '../../src';
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
    });

    const server = graph.getNodeByRef(server_ref) as ServiceNode;
    expect(server.config.environment).to.deep.equal({
      CLOUD_ADDR: `http://${app_ref}:8080`,
      CLOUD_EXT_ADDR: `http://app.arc.localhost`
    });
  });

  describe('dependency validation', () => {
    it('dependencies with no tag are valid', async () => {
      const component_config = `
        name: component
        dependencies:
          server: {}
      `;
      buildSpecFromYml(component_config);
    });

    it('dependencies with string tag are still valid', async () => {
      const component_config = `
        name: component
        dependencies:
          server: im-a-tag
      `;
      buildSpecFromYml(component_config);
    });

    it('dependencies with invalid string tag are still invalid', async () => {
      const component_config = `
        name: component
        dependencies:
          server: im-an-invalid-tag!
      `;

      expect(() => {
        buildSpecFromYml(component_config);
      }).to.throw(ValidationErrors);
    });

    it('dependencies with tag as dictionary key is valid', async () => {
      const component_config = `
        name: component
        dependencies:
          server:
            tag: im-a-tag
      `;

      buildSpecFromYml(component_config);
    });

    it('dependencies with invalid tag as dictionary key is invalid', async () => {
      const component_config = `
        name: component
        dependencies:
          server:
            tag: im-an-invalid-tag!
      `;

      expect(() => {
        buildSpecFromYml(component_config);
      }).to.throw(ValidationErrors);
    });

    it('dependencies with invalid keys are invalid', async () => {
      const component_config = `
        name: component
        dependencies:
          server:
            foo: bar
            baz: bingo
      `;

      expect(() => {
        buildSpecFromYml(component_config);
      }).to.throw(ValidationErrors);
    });

    it('dependencies with valid and invalid keys are invalid', async () => {
      const component_config = `
        name: component
        dependencies:
          server:
            foo: bar
            tag: im-a-tag
      `;

      expect(() => {
        buildSpecFromYml(component_config);
      }).to.throw(ValidationErrors);
    });
  });
});
