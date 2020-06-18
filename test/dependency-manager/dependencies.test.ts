import { expect } from '@oclif/test';
import axios from 'axios';
import { classToPlain, plainToClass } from 'class-transformer';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Build from '../../src/commands/build';
import LocalDependencyGraph from '../../src/common/dependency-manager/local-graph';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { ServiceConfigBuilder, ServiceNode } from '../../src/dependency-manager/src';

describe('dependencies', function () {
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

  describe('standard dependencies', function () {
    it('simple frontend with backend dependency', async () => {
      const frontend_config = {
        name: 'architect/frontend',
        dependencies: {
          'architect/backend': 'latest'
        }
      };

      const backend_config = {
        name: 'architect/backend'
      };

      const env_config = {
        services: {
          'architect/frontend': {
            debug: {
              path: './src/frontend'
            }
          },
          'architect/backend': {
            debug: {
              path: './src/backend'
            }
          },
        }
      };

      mock_fs({
        '/stack/src/frontend/architect.json': JSON.stringify(frontend_config),
        '/stack/src/backend/architect.json': JSON.stringify(backend_config),
        '/stack/arc.env.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
      const graph = manager.graph;
      expect(graph.nodes).length(2);
      expect(graph.nodes[0].ref).eq('architect/frontend:latest')
      expect(graph.nodes[1].ref).eq('architect/backend:latest')
      expect(graph.edges).length(1);

      const plain_graph = classToPlain(graph);
      const loaded_graph = plainToClass(LocalDependencyGraph, plain_graph);
      expect(loaded_graph.nodes).length(2);
      expect(loaded_graph.nodes[0].ref).eq('architect/frontend:latest')
      expect(loaded_graph.nodes[1].ref).eq('architect/backend:latest')
      expect(loaded_graph.edges).length(1);
    });

    it('simple remote frontend with backend dependency', async () => {
      const frontend_config_json = {
        name: 'architect/frontend',
        dependencies: {
          'architect/backend': 'latest'
        }
      };
      const frontend_config = ServiceConfigBuilder.buildFromJSON(frontend_config_json);

      moxios.stubRequest(`/accounts/architect/services/frontend/versions/latest`, {
        status: 200,
        response: { tag: 'latest', config: classToPlain(frontend_config), service: { url: 'architect/frontend:latest' } }
      });

      const backend_config = {
        name: 'architect/backend'
      };

      moxios.stubRequest(`/accounts/architect/services/backend/versions/latest`, {
        status: 200,
        response: { tag: 'latest', config: classToPlain(backend_config), service: { url: 'architect/backend:latest' } }
      });

      const env_config = {
        services: {
          'architect/frontend': 'latest'
        }
      };

      mock_fs({
        '/stack/arc.env.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
      const graph = manager.graph;
      expect(graph.nodes).length(2);
      expect(graph.nodes[0].ref).eq('architect/frontend:latest')
      expect(graph.nodes[1].ref).eq('architect/backend:latest')
      expect(graph.edges).length(1);

      const plain_graph = classToPlain(graph);
      const loaded_graph = plainToClass(LocalDependencyGraph, plain_graph);
      expect(loaded_graph.nodes).length(2);
      expect(loaded_graph.nodes[0].ref).eq('architect/frontend:latest')
      expect(loaded_graph.nodes[1].ref).eq('architect/backend:latest')
      expect(loaded_graph.edges).length(1);
    });

    it('two services that share a postgres db', async () => {
      moxios.stubRequest(`/accounts/postgres/services/postgres/versions/11`, {
        status: 200,
        response: { tag: '11', config: { name: 'postgres/postgres' }, service: { url: 'postgres:11' } }
      });

      const service_config1 = {
        name: 'architect/service1',
        dependencies: {
          'postgres/postgres': '11'
        }
      };

      const service_config2 = {
        name: 'architect/service2',
        dependencies: {
          'postgres/postgres': '11'
        }
      };

      const env_config = {
        services: {
          'architect/service1': {
            debug: {
              path: './src/service1'
            }
          },
          'architect/service2': {
            debug: {
              path: './src/service2'
            }
          },
        }
      };

      mock_fs({
        '/stack/src/service1/architect.json': JSON.stringify(service_config1),
        '/stack/src/service2/architect.json': JSON.stringify(service_config2),
        '/stack/arc.env.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
      const graph = manager.graph;
      expect(graph.nodes).length(3);
      expect(graph.edges).length(2);
    });

    it('two services that use different postgres dbs', async () => {
      moxios.stubRequest(`/accounts/postgres/services/postgres/versions/11`, {
        status: 200,
        response: { tag: '11', config: { name: 'postgres/postgres' }, service: { url: 'postgres:11' } }
      });
      moxios.stubRequest(`/accounts/postgres/services/postgres/versions/12`, {
        status: 200,
        response: { tag: '12', config: { name: 'postgres/postgres' }, service: { url: 'postgres:12' } }
      });

      const service_config1 = {
        name: 'architect/service1',
        dependencies: {
          'postgres/postgres': '11'
        }
      };

      const service_config2 = {
        name: 'architect/service2',
        dependencies: {
          'postgres/postgres': '12'
        }
      };

      const env_config = {
        services: {
          'architect/service1': {
            debug: {
              path: './src/service1'
            }
          },
          'architect/service2': {
            debug: {
              path: './src/service2'
            }
          },
        }
      };

      mock_fs({
        '/stack/src/service1/architect.json': JSON.stringify(service_config1),
        '/stack/src/service2/architect.json': JSON.stringify(service_config2),
        '/stack/arc.env.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
      const graph = manager.graph;
      expect(graph.nodes).length(4);
      expect(graph.nodes.map((n) => n.ref)).members([
        'architect/service1:latest',
        'architect/service2:latest',
        'postgres/postgres:11',
        'postgres/postgres:12'
      ]);
      expect(graph.edges).length(2);
    });
  });

  describe('extends dependencies', function () {
    it('simple extends dependency', async () => {
      moxios.stubRequest(`/accounts/postgres/services/postgres/versions/11`, {
        status: 200,
        response: { tag: '11', config: { name: 'postgres/postgres' }, service: { url: 'postgres:11' } }
      });

      const backend_config = {
        name: 'architect/backend',
        dependencies: {
          'db': 'postgres/postgres:11'
        }
      };

      const env_config = {
        services: {
          'architect/backend': {
            debug: {
              path: './src/backend'
            }
          }
        }
      };

      mock_fs({
        '/stack/src/backend/architect.json': JSON.stringify(backend_config),
        '/stack/arc.env.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
      const graph = manager.graph;
      expect(graph.nodes).length(2);
      expect(graph.nodes[0].ref).eq('architect/backend:latest');
      expect(graph.nodes[1].ref).eq('db:latest');
      expect((graph.nodes[1] as ServiceNode).image).eq('postgres:11');
      expect(graph.edges).length(1);
    });

    it('chained extends', async () => {
      const service_config = {
        name: 'forked/payments-service',
        extends: 'architect/payments-service:v1'
      }

      moxios.stubRequest(`/accounts/forked/services/payments-service/versions/v1`, {
        status: 200,
        response: { tag: 'v1', config: service_config, service: { url: 'forked/payments-service:v1' } }
      });

      moxios.stubRequest(`/accounts/architect/services/payments-service/versions/v1`, {
        status: 200,
        response: { tag: 'v1', config: { name: 'architect/payments-service', parameters: { WORKED: 1 } }, service: { url: 'architect/payments-service:v1' } }
      });

      const env_config = {
        services: {
          'forked/payments-service': 'v1'
        }
      };

      mock_fs({
        '/stack/arc.env.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
      const graph = manager.graph;
      expect(graph.nodes).length(1);
      expect((graph.nodes[0] as ServiceNode).node_config.getParameters()).keys(['WORKED']);
      expect((graph.nodes[0] as ServiceNode).ref).eq('forked/payments-service:v1');
      expect((graph.nodes[0] as ServiceNode).image).eq('forked/payments-service:v1');
      expect(graph.edges).length(0);
    });

    it('check config refs', async () => {
      for (var i = 1; i < 4; i++) {
        moxios.stubRequest(`/accounts/architect/services/checkouts-service/versions/v` + i, {
          status: 200,
          response: { tag: 'v' + i, config: { name: 'architect/checkouts-service', parameters: { WORKED: 1 } }, service: { url: 'architect/checkouts-service:v' + i } }
        });
      }
      const env_config = {
        services: {
          'architect/checkouts-service': 'v1',
          'architect/checkouts-service:v2': {
            dependencies: {
              'architect/checkouts-service': 'v3'
            }
          }
        }
      };

      mock_fs({
        '/stack/arc.env.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
      const graph = manager.graph;
      expect(graph.nodes).length(3);
      expect(graph.edges).length(1);

      expect(graph.nodes[0].ref).eq('architect/checkouts-service:v1');
      expect(graph.nodes[1].ref).eq('architect/checkouts-service:v2');
      expect(graph.nodes[2].ref).eq('architect/checkouts-service:v3');
    });
  });
});
