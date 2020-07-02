import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Register from '../../../src/commands/register';
import LocalDependencyManager from '../../../src/common/dependency-manager/local-manager';
import { ServiceNode } from '../../../src/dependency-manager/src';

describe('old external nodes', function () {
  beforeEach(async () => {
    // Stub the logger
    sinon.replace(Register.prototype, 'log', sinon.stub());
    moxios.install();
    moxios.wait(function () {
      let request = moxios.requests.mostRecent()
      if (request) {
        request.respondWith({
          status: 404,
        })
      }
    });
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

    moxios.stubRequest(`/accounts/architect/components/frontend/versions/v1`, {
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
    const graph = await manager.getGraph();

    expect(graph.nodes).length(2);
    const frontend_node = graph.getNodeByRef('architect/frontend/service:v1');
    expect(frontend_node.is_external).true;
    expect(frontend_node.interfaces.app.host).eq('app.localhost');
    expect(frontend_node.interfaces.app.port).eq('80');
    expect(graph.edges).length(1);
  });

  it('external service with dependency', async () => {
    const frontend_config = {
      name: 'architect/frontend',
      interfaces: {
        app: 8080
      },
      dependencies: {
        'architect/backend': 'v1'
      }
    };

    moxios.stubRequest(`/accounts/architect/components/frontend/versions/v1`, {
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

    moxios.stubRequest(`/accounts/architect/components/backend/versions/v1`, {
      status: 200,
      response: { tag: 'v1', config: {}, service: { url: 'architect/backend:v1' } }
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const graph = await manager.getGraph();
    expect(graph.nodes).length(3);
    const frontend_node = graph.getNodeByRef('architect/frontend/service:v1');
    expect(frontend_node.is_external).true;
    expect(frontend_node.interfaces.app.host).eq('app.localhost');
    expect(frontend_node.interfaces.app.port).eq('80');
    expect(graph.edges).length(1);
  });

  it('external dependency in env config', async () => {
    const frontend_config = {
      name: 'architect/frontend',
      interfaces: {
        app: 8080
      },
      environment: {
        BACKEND_ADDR: '${ dependencies.architect/backend.interfaces.api.url }'
      },
      dependencies: {
        'architect/backend': 'v1'
      }
    };

    moxios.stubRequest(`/accounts/architect/components/frontend/versions/v1`, {
      status: 200,
      response: { tag: 'v1', config: frontend_config, service: { url: 'architect/frontend:v1' } }
    });

    moxios.stubRequest(`/accounts/architect/components/backend/versions/v1`, {
      status: 200,
      response: { tag: 'v1', config: { interfaces: { api: 8080 } }, service: { url: 'architect/backend:v1' } }
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
    const graph = await manager.getGraph();
    expect(graph.nodes).length(4);
    const backend_node = graph.getNodeByRef('architect/backend/service:v1');
    expect(backend_node.is_external).true;
    expect(backend_node.interfaces.api.host).eq('api.localhost');
    expect(backend_node.interfaces.api.port).eq('80');
    expect(graph.edges).length(3);
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

    moxios.stubRequest(`/accounts/architect/components/frontend/versions/v1`, {
      status: 200,
      response: { tag: 'v1', config: frontend_config, service: { url: 'architect/frontend:v1' } }
    });

    moxios.stubRequest(`/accounts/architect/components/backend/versions/v2`, {
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
    const graph = await manager.getGraph();
    expect(graph.nodes).length(4);
    const frontend_node = graph.getNodeByRef('architect/frontend/service:v1');
    expect(frontend_node).instanceOf(ServiceNode);
    const backend_node = graph.getNodeByRef('architect/backend/service:v2');
    expect(backend_node.is_external).true;
    expect(backend_node.interfaces.api.host).eq('api.localhost');
    expect(backend_node.interfaces.api.port).eq('80');
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

    moxios.stubRequest(`/accounts/architect/components/frontend/versions/v1`, {
      status: 200,
      response: { tag: 'v1', config: frontend_config, service: { url: 'architect/frontend:v1' } }
    });

    moxios.stubRequest(`/accounts/architect/components/backend/versions/v1`, {
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
    const graph = await manager.getGraph();
    expect(graph.nodes).length(5);
    const frontend_node = graph.getNodeByRef('architect/frontend/service:v1');
    expect(frontend_node).instanceOf(ServiceNode);
    const backend_db_node = graph.getNodeByRef('architect/backend/datastore-primary:v1');
    expect(backend_db_node.is_external).true;
    expect(backend_db_node.interfaces.main.host).eq('db.localhost');
    expect(backend_db_node.interfaces.main.port).eq('80');
    const backend_node = graph.getNodeByRef('architect/backend/service:v1');
    expect(backend_node).instanceOf(ServiceNode);
  });
});
