import { expect } from '@oclif/test';
import axios from 'axios';
import yaml from 'js-yaml';
import nock from 'nock';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';

describe('graph', () => {

  it('graph without interpolation', async () => {
    const component_config = `
      name: component

      dependencies:
        dependency: latest
        missing-dependency: latest

      secrets:
        MYSQL_DATABASE:
          required: true

      interfaces:
        db: \${{ services.db.interfaces.mysql.url }}

      services:
        db:
          image: mysql:5.6.35
          command: mysqld
          interfaces:
            mysql:
              port: 3306
              protocol: https

        core:
          environment:
            ADDR: \${{ ingresses.db.url }}
            DEP_ADDR: \${{ dependencies.dependency.interfaces.db.url }}
            DEP_INGRESS_ADDR: \${{ dependencies.dependency.ingresses.db.url }}
            DEP_MISSING_ADDR: \${{ dependencies.missing-dependency.interfaces.db.url }}
            DEP_MISSING_INGRESS_ADDR: \${{ dependencies.missing-dependency.ingresses.db.url }}
    `;

    const dependency_config = `
      name: dependency

      secrets:
        MYSQL_DATABASE:
          required: true

      interfaces:
        db: \${{ services.db.interfaces.mysql.url }}

      services:
        db:
          image: mysql:5.6.35
          command: mysqld
          interfaces:
            mysql:
              port: 3306
              protocol: mysql

        core:
          environment:
            ADDR: \${{ ingresses.db.url }}
    `;

    nock('http://localhost').get('/accounts/architect/components/component/versions/latest')
      .reply(200, { tag: 'latest', config: yaml.load(component_config), service: { url: 'component:latest' } });

    nock('http://localhost').get('/accounts/architect/components/dependency/versions/latest')
      .reply(200, { tag: 'latest', config: yaml.load(dependency_config), service: { url: 'dependency:latest' } });

    const manager = new LocalDependencyManager(axios.create());
    manager.account = 'architect';

    const graph = await manager.getGraph([
      await manager.loadComponentSpec('component:latest'),
      await manager.loadComponentSpec('dependency:latest', { interfaces: { db2: 'db' } })
    ], {}, { interpolate: false });

    expect(graph.nodes).to.have.length(7);
    expect(graph.edges).to.have.length(5);
  });

  it('graph without validation', async () => {
    const component_config = `
      name: component

      dependencies:
        dependency: latest

      secrets:
        external_host:

      services:
        db:
          interfaces:
            main:
              port: 5432
              host: \${{ secrets.external_host }}
          environment:
            OTHER_DB_ADDR: \${{ dependencies.dependency.interfaces.db.url }}
    `;

    const dependency_config = `
      name: dependency

      secrets:
        external_host:

      interfaces:
        db: \${{ services.db.interfaces.mysql.url }}

      services:
        db:
          interfaces:
            mysql:
              port: 3306
              protocol: mysql
              host: \${{ secrets.external_host }}
    `;

    nock('http://localhost').get('/accounts/architect/components/component/versions/latest')
      .reply(200, { tag: 'latest', config: yaml.load(component_config), service: { url: 'component:latest' } });

    nock('http://localhost').get('/accounts/architect/components/dependency/versions/latest')
      .reply(200, { tag: 'latest', config: yaml.load(dependency_config), service: { url: 'dependency:latest' } });

    const manager = new LocalDependencyManager(axios.create());
    manager.account = 'architect';

    const graph = await manager.getGraph([
      await manager.loadComponentSpec('component:latest'),
      await manager.loadComponentSpec('dependency:latest')
    ], {}, { interpolate: true, validate: false });

    expect(graph.nodes).to.have.length(3);
    expect(graph.edges).to.have.length(2);
  });
});
