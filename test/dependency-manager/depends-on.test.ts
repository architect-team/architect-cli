import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import { resourceRefToNodeRef, ServiceNode } from '../../src';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';

describe('graph depends_on', () => {
  it('happy path depends_on', async () => {
    const component_config = `
      name: cloud
      services:
        app:
          interfaces:
            main: 8080
          depends_on:
            - api
        api:
          interfaces:
            main: 8080
          depends_on:
            - db
        db:
          interfaces:
            postgres: 5432
    `;

    mock_fs({
      '/stack/architect.yml': component_config,
    });
    const manager = new LocalDependencyManager(axios.create(), {
      'cloud': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('cloud:latest'),
    ]);

    const app_ref = resourceRefToNodeRef('cloud.services.app');
    const app = graph.getNodeByRef(app_ref) as ServiceNode;

    const api_ref = resourceRefToNodeRef('cloud.services.api');
    const api = graph.getNodeByRef(api_ref) as ServiceNode;

    const db_ref = resourceRefToNodeRef('cloud.services.db');
    const db = graph.getNodeByRef(db_ref) as ServiceNode;

    const app_depends_on = graph.getDependsOn(app);
    expect(app_depends_on.length).to.equal(1);
    expect(app_depends_on[0].ref).to.equal(api_ref);

    const api_depends_on = graph.getDependsOn(api);
    expect(api_depends_on.length).to.equal(1);
    expect(api_depends_on[0].ref).to.equal(db_ref);

    const db_depends_on = graph.getDependsOn(db);
    expect(db_depends_on.length).to.equal(0);
  });

  it('multiple depends_on', async () => {
    const component_config = `
      name: cloud
      services:
        app:
          interfaces:
            main: 8080
          depends_on:
            - api
            - db
        api:
          interfaces:
            main: 8080
          depends_on:
            - db
        db:
          interfaces:
            postgres: 5432
    `;

    mock_fs({
      '/stack/architect.yml': component_config,
    });
    const manager = new LocalDependencyManager(axios.create(), {
      'cloud': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('cloud:latest'),
    ]);

    const app_ref = resourceRefToNodeRef('cloud.services.app');
    const app = graph.getNodeByRef(app_ref) as ServiceNode;

    const api_ref = resourceRefToNodeRef('cloud.services.api');
    const api = graph.getNodeByRef(api_ref) as ServiceNode;

    const db_ref = resourceRefToNodeRef('cloud.services.db');
    const db = graph.getNodeByRef(db_ref) as ServiceNode;

    const app_depends_on = graph.getDependsOn(app);
    expect(app_depends_on.length).to.equal(2);
    expect(app_depends_on[0].ref).to.equal(api_ref);
    expect(app_depends_on[1].ref).to.equal(db_ref);

    const api_depends_on = graph.getDependsOn(api);
    expect(api_depends_on.length).to.equal(1);
    expect(api_depends_on[0].ref).to.equal(db_ref);

    const db_depends_on = graph.getDependsOn(db);
    expect(db_depends_on.length).to.equal(0);
  });

  it('no depends_on', async () => {
    const component_config = `
      name: cloud
      services:
        app:
          interfaces:
            main: 8080
        api:
          interfaces:
            main: 8080
        db:
          interfaces:
            postgres: 5432
    `;

    mock_fs({
      '/stack/architect.yml': component_config,
    });
    const manager = new LocalDependencyManager(axios.create(), {
      'cloud': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('cloud:latest'),
    ]);

    const app_ref = resourceRefToNodeRef('cloud.services.app');
    const app = graph.getNodeByRef(app_ref) as ServiceNode;

    const api_ref = resourceRefToNodeRef('cloud.services.api');
    const api = graph.getNodeByRef(api_ref) as ServiceNode;

    const db_ref = resourceRefToNodeRef('cloud.services.db');
    const db = graph.getNodeByRef(db_ref) as ServiceNode;

    const app_depends_on = graph.getDependsOn(app);
    expect(app_depends_on.length).to.equal(0);

    const api_depends_on = graph.getDependsOn(api);
    expect(api_depends_on.length).to.equal(0);

    const db_depends_on = graph.getDependsOn(db);
    expect(db_depends_on.length).to.equal(0);
  });

  it('external depends_on', async () => {
    const component_config = `
      name: cloud
      services:
        app:
          interfaces:
            main: 8080
          depends_on:
            - api
        api:
          interfaces:
            main: 8080
          depends_on:
            - db
        db:
          interfaces:
            postgres:
              host: 10.0.0.42
              port: 5432
    `;

    mock_fs({
      '/stack/architect.yml': component_config,
    });
    const manager = new LocalDependencyManager(axios.create(), {
      'cloud': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('cloud:latest'),
    ]);

    const app_ref = resourceRefToNodeRef('cloud.services.app');
    const app = graph.getNodeByRef(app_ref) as ServiceNode;

    const api_ref = resourceRefToNodeRef('cloud.services.api');
    const api = graph.getNodeByRef(api_ref) as ServiceNode;

    const db_ref = resourceRefToNodeRef('cloud.services.db');
    const db = graph.getNodeByRef(db_ref) as ServiceNode;

    const app_depends_on = graph.getDependsOn(app);
    expect(app_depends_on.length).to.equal(1);
    expect(app_depends_on[0].ref).to.equal(api_ref);

    const api_depends_on = graph.getDependsOn(api);
    expect(api_depends_on.length).to.equal(0);

    const db_depends_on = graph.getDependsOn(db);
    expect(db_depends_on.length).to.equal(0);
  });

  it('cross component depends_on', async () => {
    const component_config = `
      name: cloud
      dependencies:
        dependency: latest
      services:
        app:
          interfaces:
            main: 8080
          environment:
            API_URL: \${{ dependencies.dependency.interfaces.api.url }}
    `;

    const dependency_config = `
      name: dependency
      services:
        api:
          interfaces:
            api: 443
        db:
          interfaces:
            postgres: 5432
      interfaces:
        api: \${{ services.api.interfaces.api.url }}
        db: \${{ services.db.interfaces.postgres.url }}
    `;

    mock_fs({
      '/stack/architect.yml': component_config,
      '/stack/dependency.yml': dependency_config,
    });
    const manager = new LocalDependencyManager(axios.create(), {
      'cloud': '/stack/architect.yml',
      'dependency': '/stack/dependency.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('cloud:latest'),
      await manager.loadComponentSpec('dependency:latest'),
    ]);

    const app_ref = resourceRefToNodeRef('cloud.services.app');
    const app = graph.getNodeByRef(app_ref) as ServiceNode;

    const api_ref = resourceRefToNodeRef('dependency.services.api');
    const api = graph.getNodeByRef(api_ref) as ServiceNode;

    const db_ref = resourceRefToNodeRef('dependency.services.db');
    const db = graph.getNodeByRef(db_ref) as ServiceNode;

    const app_depends_on = graph.getDependsOn(app);
    expect(app_depends_on.length).to.equal(2);
    expect(app_depends_on[0].ref).to.equal(api_ref);
    expect(app_depends_on[1].ref).to.equal(db_ref);

    const api_depends_on = graph.getDependsOn(api);
    expect(api_depends_on.length).to.equal(0);

    const db_depends_on = graph.getDependsOn(db);
    expect(db_depends_on.length).to.equal(0);
  });

  it('cross component multiple depends_on', async () => {
    const component_config = `
      name: cloud
      dependencies:
        dependency: latest
      services:
        app:
          interfaces:
            main: 8080
          environment:
            API_URL: \${{ dependencies.dependency.interfaces.api.url }}
            DB_URL: \${{ dependencies.dependency.interfaces.db.url }}
    `;

    const dependency_config = `
      name: dependency
      services:
        api:
          interfaces:
            api: 443
        db:
          interfaces:
            postgres: 5432
      interfaces:
        api: \${{ services.api.interfaces.api.url }}
        db: \${{ services.db.interfaces.postgres.url }}
    `;

    mock_fs({
      '/stack/architect.yml': component_config,
      '/stack/dependency.yml': dependency_config,
    });
    const manager = new LocalDependencyManager(axios.create(), {
      'cloud': '/stack/architect.yml',
      'dependency': '/stack/dependency.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('cloud:latest'),
      await manager.loadComponentSpec('dependency:latest'),
    ]);

    const app_ref = resourceRefToNodeRef('cloud.services.app');
    const app = graph.getNodeByRef(app_ref) as ServiceNode;

    const api_ref = resourceRefToNodeRef('dependency.services.api');
    const api = graph.getNodeByRef(api_ref) as ServiceNode;

    const db_ref = resourceRefToNodeRef('dependency.services.db');
    const db = graph.getNodeByRef(db_ref) as ServiceNode;

    const app_depends_on = graph.getDependsOn(app);
    expect(app_depends_on.length).to.equal(2);
    expect(app_depends_on[0].ref).to.equal(api_ref);
    expect(app_depends_on[1].ref).to.equal(db_ref);

    const api_depends_on = graph.getDependsOn(api);
    expect(api_depends_on.length).to.equal(0);

    const db_depends_on = graph.getDependsOn(db);
    expect(db_depends_on.length).to.equal(0);
  });

  it('cross component multiple interfaces to same service depends_on', async () => {
    const component_config = `
      name: cloud
      dependencies:
        dependency: latest
      services:
        app:
          interfaces:
            main: 8080
          environment:
            API_URL: \${{ dependencies.dependency.interfaces.api.url }}
            API_2_URL: \${{ dependencies.dependency.interfaces.api-2.url }}
    `;

    const dependency_config = `
      name: dependency
      services:
        api:
          interfaces:
            api: 443
            other: 8080
      interfaces:
        api: \${{ services.api.interfaces.api.url }}
        api-2: \${{ services.api.interfaces.other.url }}
    `;

    mock_fs({
      '/stack/architect.yml': component_config,
      '/stack/dependency.yml': dependency_config,
    });
    const manager = new LocalDependencyManager(axios.create(), {
      'cloud': '/stack/architect.yml',
      'dependency': '/stack/dependency.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('cloud:latest'),
      await manager.loadComponentSpec('dependency:latest'),
    ]);

    const app_ref = resourceRefToNodeRef('cloud.services.app');
    const app = graph.getNodeByRef(app_ref) as ServiceNode;

    const api_ref = resourceRefToNodeRef('dependency.services.api');
    const api = graph.getNodeByRef(api_ref) as ServiceNode;

    const app_depends_on = graph.getDependsOn(app);
    expect(app_depends_on.length).to.equal(1);
    expect(app_depends_on[0].ref).to.equal(api_ref);

    const api_depends_on = graph.getDependsOn(api);
    expect(api_depends_on.length).to.equal(0);
  });

  it('cross component chained depends_on', async () => {
    const component_config = `
      name: cloud
      dependencies:
        dependency: latest
      services:
        app:
          interfaces:
            main: 8080
          environment:
            API_URL: \${{ dependencies.dependency.interfaces.api.url }}
    `;

    const dependency_config = `
      name: dependency
      services:
        api:
          interfaces:
            api: 443
          depends_on:
            - db
        db:
          interfaces:
            postgres: 5432
      interfaces:
        api: \${{ services.api.interfaces.api.url }}
        db: \${{ services.db.interfaces.postgres.url }}
    `;

    mock_fs({
      '/stack/architect.yml': component_config,
      '/stack/dependency.yml': dependency_config,
    });
    const manager = new LocalDependencyManager(axios.create(), {
      'cloud': '/stack/architect.yml',
      'dependency': '/stack/dependency.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('cloud:latest'),
      await manager.loadComponentSpec('dependency:latest'),
    ]);

    const app_ref = resourceRefToNodeRef('cloud.services.app');
    const app = graph.getNodeByRef(app_ref) as ServiceNode;

    const api_ref = resourceRefToNodeRef('dependency.services.api');
    const api = graph.getNodeByRef(api_ref) as ServiceNode;

    const db_ref = resourceRefToNodeRef('dependency.services.db');
    const db = graph.getNodeByRef(db_ref) as ServiceNode;

    const app_depends_on = graph.getDependsOn(app);
    expect(app_depends_on.length).to.equal(2);
    expect(app_depends_on[0].ref).to.equal(api_ref);
    expect(app_depends_on[1].ref).to.equal(db_ref);

    const api_depends_on = graph.getDependsOn(api);
    expect(api_depends_on.length).to.equal(1);
    expect(api_depends_on[0].ref).to.equal(db_ref);

    const db_depends_on = graph.getDependsOn(db);
    expect(db_depends_on.length).to.equal(0);
  });

  it('cross component multiple and chained depends_on', async () => {
    const component_config = `
      name: cloud
      dependencies:
        dependency: latest
      services:
        app:
          interfaces:
            main: 8080
          environment:
            API_URL: \${{ dependencies.dependency.interfaces.api.url }}
            DB_URL: \${{ dependencies.dependency.interfaces.db.url }}
    `;

    const dependency_config = `
      name: dependency
      services:
        api:
          interfaces:
            api: 443
          depends_on:
            - db
        db:
          interfaces:
            postgres: 5432
      interfaces:
        api: \${{ services.api.interfaces.api.url }}
        db: \${{ services.db.interfaces.postgres.url }}
    `;

    mock_fs({
      '/stack/architect.yml': component_config,
      '/stack/dependency.yml': dependency_config,
    });
    const manager = new LocalDependencyManager(axios.create(), {
      'cloud': '/stack/architect.yml',
      'dependency': '/stack/dependency.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('cloud:latest'),
      await manager.loadComponentSpec('dependency:latest'),
    ]);

    const app_ref = resourceRefToNodeRef('cloud.services.app');
    const app = graph.getNodeByRef(app_ref) as ServiceNode;

    const api_ref = resourceRefToNodeRef('dependency.services.api');
    const api = graph.getNodeByRef(api_ref) as ServiceNode;

    const db_ref = resourceRefToNodeRef('dependency.services.db');
    const db = graph.getNodeByRef(db_ref) as ServiceNode;

    const app_depends_on = graph.getDependsOn(app);
    expect(app_depends_on.length).to.equal(2);
    expect(app_depends_on[0].ref).to.equal(api_ref);
    expect(app_depends_on[1].ref).to.equal(db_ref);

    const api_depends_on = graph.getDependsOn(api);
    expect(api_depends_on.length).to.equal(1);
    expect(api_depends_on[0].ref).to.equal(db_ref);

    const db_depends_on = graph.getDependsOn(db);
    expect(db_depends_on.length).to.equal(0);
  });
});
