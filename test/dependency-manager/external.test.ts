import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Build from '../../src/commands/build';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { ServiceNode } from '../../src/dependency-manager/src';

describe('external nodes', function () {
  beforeEach(async () => {
    // Stub the logger
    sinon.replace(Build.prototype, 'log', sinon.stub());
    moxios.install();
  });

  afterEach(function () {
    // Restore stubs
    sinon.restore();
    // Restore fs
    mock_fs.restore();
    moxios.uninstall();
  });

  it('simple external service', async () => {
    const frontend_config = {
      name: 'architect/frontend',
      interfaces: {
        app: 8080
      }
    };

    moxios.stubRequest(`/accounts/architect/services/frontend/versions/v1`, {
      status: 200,
      response: { tag: 'v1', config: frontend_config, service: { url: 'architect/frontend:v1' } }
    });

    const env_config = {
      services: {
        'architect/frontend:v1': {
          interfaces: {
            app: {
              host: 'app.localhost',
              port: 80
            }
          }
        }
      }
    };

    mock_fs({
      '/stack/src/frontend/architect.json': JSON.stringify(frontend_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const graph = manager.graph;

    expect(graph.nodes).length(1);
    expect((graph.nodes[0] as ServiceNode).is_external).true;
    expect(graph.nodes[0].interfaces.app.host).eq('app.localhost');
    expect(graph.nodes[0].interfaces.app.port).eq(80);
    expect(graph.edges).length(0);
  });

  it('external service - no dependencies created', async () => {
    const frontend_config = {
      name: 'architect/frontend',
      interfaces: {
        app: 8080
      },
      dependencies: {
        'architect/backend': 'v1'
      }
    };

    moxios.stubRequest(`/accounts/architect/services/frontend/versions/v1`, {
      status: 200,
      response: { tag: 'v1', config: frontend_config, service: { url: 'architect/frontend:v1' } }
    });

    const env_config = {
      services: {
        'architect/frontend:v1': {
          interfaces: {
            app: {
              host: 'app.localhost',
              port: 80
            }
          }
        }
      }
    };

    mock_fs({
      '/stack/src/frontend/architect.json': JSON.stringify(frontend_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const graph = manager.graph;
    expect(graph.nodes).length(1);
    expect((graph.nodes[0] as ServiceNode).is_external).true;
    expect(graph.nodes[0].interfaces.app.host).eq('app.localhost');
    expect(graph.nodes[0].interfaces.app.port).eq(80);
    expect(graph.edges).length(0);
  });

  it('external dependency in env config', async () => {
    const frontend_config = {
      name: 'architect/frontend',
      interfaces: {
        app: 8080
      },
      environment: {
        BACKEND_ADDR: '${ dependencies.architect/backend.services.service.interfaces.api.url }'
      },
      dependencies: {
        'architect/backend': 'v1'
      }
    };

    moxios.stubRequest(`/accounts/architect/services/frontend/versions/v1`, {
      status: 200,
      response: { tag: 'v1', config: frontend_config, service: { url: 'architect/frontend:v1' } }
    });

    moxios.stubRequest(`/accounts/architect/services/backend/versions/v1`, {
      status: 200,
      response: { tag: 'v1', config: {}, service: { url: 'architect/backend:v1' } }
    });

    const env_config = {
      services: {
        'architect/frontend:v1': {},
        'architect/backend:v1': {
          interfaces: {
            api: {
              host: 'api.localhost',
              port: 80
            }
          }
        }
      }
    };

    mock_fs({
      '/stack/src/frontend/architect.json': JSON.stringify(frontend_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const graph = manager.graph;
    expect(graph.nodes).length(2);
    expect(graph.nodes[0]).instanceOf(ServiceNode);
    expect((graph.nodes[1] as ServiceNode).is_external).true;
    expect(graph.nodes[1].interfaces.api.host).eq('api.localhost');
    expect(graph.nodes[1].interfaces.api.port).eq(80);
    expect(graph.edges).length(1);
  });

  it('external dependency override', async () => {
    const frontend_config = {
      name: 'architect/frontend',
      interfaces: {
        app: 8080
      },
      dependencies: {
        'architect/backend': 'v2'
      }
    };

    const backend_config = {
      name: 'architect/backend',
      interfaces: {
        api: 8080
      }
    };

    moxios.stubRequest(`/accounts/architect/services/frontend/versions/v1`, {
      status: 200,
      response: { tag: 'v1', config: frontend_config, service: { url: 'architect/frontend:v1' } }
    });

    moxios.stubRequest(`/accounts/architect/services/backend/versions/v2`, {
      status: 200,
      response: { tag: 'v2', config: backend_config, service: { url: 'architect/backend:v2' } }
    });

    const env_config = {
      services: {
        'architect/frontend:v1': {},
        'architect/backend:v2': {
          interfaces: {
            api: {
              host: 'api.localhost',
              port: 80
            }
          }
        }
      }
    };

    mock_fs({
      '/stack/src/frontend/architect.json': JSON.stringify(frontend_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const graph = manager.graph;
    expect(graph.nodes).length(2);
    expect(graph.nodes[0]).instanceOf(ServiceNode);
    expect(graph.nodes[0].ref).eq('architect/frontend/service:v1')
    expect((graph.nodes[1] as ServiceNode).is_external).true;
    expect(graph.nodes[1].ref).eq('architect/backend/service:v2')
    expect(graph.nodes[1].interfaces.api.host).eq('api.localhost');
    expect(graph.nodes[1].interfaces.api.port).eq(80);
  });

  it('external datastore', async () => {
    const frontend_config = {
      name: 'architect/frontend',
      interfaces: {
        app: 8080
      },
      dependencies: {
        'architect/backend': 'v1'
      }
    };

    const backend_config = {
      name: 'architect/backend',
      interfaces: {
        api: 8080
      },
      datastores: {
        primary: {
          image: 'postgres:11',
          port: 5432
        }
      }
    };

    moxios.stubRequest(`/accounts/architect/services/frontend/versions/v1`, {
      status: 200,
      response: { tag: 'v1', config: frontend_config, service: { url: 'architect/frontend:v1' } }
    });

    moxios.stubRequest(`/accounts/architect/services/backend/versions/v1`, {
      status: 200,
      response: { tag: 'v1', config: backend_config, service: { url: 'architect/backend:v1' } }
    });

    const env_config = {
      services: {
        'architect/frontend:v1': {},
        'architect/backend:v1': {
          datastores: {
            primary: {
              host: 'db.localhost',
              port: 80
            }
          }
        }
      }
    };

    mock_fs({
      '/stack/src/frontend/architect.json': JSON.stringify(frontend_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const graph = manager.graph;
    expect(graph.nodes).length(3);
    expect(graph.nodes[0]).instanceOf(ServiceNode);
    expect((graph.nodes[1] as ServiceNode).is_external).true;
    expect(graph.nodes[1].interfaces.main.host).eq('db.localhost');
    expect(graph.nodes[1].interfaces.main.port).eq(80);
    expect(graph.nodes[2]).instanceOf(ServiceNode);
  });
});
