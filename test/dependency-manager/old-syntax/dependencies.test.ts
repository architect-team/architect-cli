import { expect } from '@oclif/test';
import axios from 'axios';
import { classToPlain, plainToClass } from 'class-transformer';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Register from '../../../src/commands/register';
import LocalDependencyManager from '../../../src/common/dependency-manager/local-manager';
import { ServiceConfigBuilder, ServiceNode } from '../../../src/dependency-manager/src';
import DependencyGraph from '../../../src/dependency-manager/src/graph';

describe('old dependencies', function () {
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
    })
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
      const graph = await manager.getGraph();
      expect(graph.nodes).length(2);
      expect(graph.nodes[0].ref).eq('architect/frontend/service:latest')
      expect(graph.nodes[1].ref).eq('architect/backend/service:latest')
      expect(graph.edges).length(0);

      const plain_graph = classToPlain(graph);
      const loaded_graph = plainToClass(DependencyGraph, plain_graph);
      expect(loaded_graph.nodes).length(2);
      expect(loaded_graph.nodes[0].ref).eq('architect/frontend/service:latest')
      expect(loaded_graph.nodes[1].ref).eq('architect/backend/service:latest')
      expect(loaded_graph.edges).length(0);
    });

    it('simple remote frontend with backend dependency', async () => {
      const frontend_config_json = {
        name: 'architect/frontend',
        dependencies: {
          'architect/backend': 'latest'
        }
      };
      const frontend_config = ServiceConfigBuilder.buildFromJSON(frontend_config_json);

      moxios.stubRequest(`/accounts/architect/components/frontend/versions/latest`, {
        status: 200,
        response: { tag: 'latest', config: classToPlain(frontend_config), service: { url: 'architect/frontend/service:latest' } }
      });

      const backend_config = {
        name: 'architect/backend'
      };

      moxios.stubRequest(`/accounts/architect/components/backend/versions/latest`, {
        status: 200,
        response: { tag: 'latest', config: classToPlain(backend_config), service: { url: 'architect/backend/service:latest' } }
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
      const graph = await manager.getGraph();
      expect(graph.nodes).length(2);
      expect(graph.nodes[0].ref).eq('architect/frontend/service:latest')
      expect(graph.nodes[1].ref).eq('architect/backend/service:latest')
      expect(graph.edges).length(0);

      const plain_graph = classToPlain(graph);
      const loaded_graph = plainToClass(DependencyGraph, plain_graph);
      expect(loaded_graph.nodes).length(2);
      expect(loaded_graph.nodes[0].ref).eq('architect/frontend/service:latest')
      expect(loaded_graph.nodes[1].ref).eq('architect/backend/service:latest')
      expect(loaded_graph.edges).length(0);
    });

    it('two services that share a postgres db', async () => {
      moxios.stubRequest(`/accounts/postgres/components/postgres/versions/11`, {
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
      const graph = await manager.getGraph();
      expect(graph.nodes).length(3);
      expect(graph.edges).length(0);
    });

    it('two services that use different postgres dbs', async () => {
      moxios.stubRequest(`/accounts/postgres/components/postgres/versions/11`, {
        status: 200,
        response: { tag: '11', config: { name: 'postgres/postgres' }, service: { url: 'postgres:11' } }
      });
      moxios.stubRequest(`/accounts/postgres/components/postgres/versions/12`, {
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
      const graph = await manager.getGraph();
      expect(graph.nodes).length(4);
      expect(graph.nodes.map((n) => n.ref)).members([
        'architect/service1/service:latest',
        'architect/service2/service:latest',
        'postgres/postgres/service:11',
        'postgres/postgres/service:12'
      ]);
      expect(graph.edges).length(0);
    });
  });

  describe('inline dependencies', function () {
    it('simple inline dependency', async () => {
      const backend_config = `
      name: architect/backend
      dependencies:
        db:
          image: postgres:11
          interfaces:
            postgres: 5432
          parameters:
            POSTGRES_USER:
              default: postgres
            POSTGRES_PASSWORD: architect
            POSTGRES_DB: test_database
      environment:
        POSTGRES_HOST: \${ dependencies.db.interfaces.postgres.internal.host}
        POSTGRES_PORT: \${ dependencies['db'].interfaces.postgres.internal.port}
        POSTGRES_USER: \${ dependencies["db"].parameters.POSTGRES_USER }
        POSTGRES_PASSWORD: \${ dependencies["db"].parameters.POSTGRES_PASSWORD }
      parameters:
        POSTGRES_DB:
          default: \${ dependencies["db"].parameters.POSTGRES_DB }
      `

      const env_config = {
        services: {
          'architect/backend': {
            debug: {
              path: './src/backend'
            }
          },
        }
      };

      mock_fs({
        '/stack/src/backend/architect.json': backend_config,
        '/stack/arc.env.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
      const graph = await manager.getGraph();
      expect(graph.nodes.map((n) => n.ref)).has.members([
        'architect/backend/db:latest',
        'architect/backend/service:latest'
      ])
      expect(graph.edges.map((e) => e.toString())).has.members([
        'architect/backend/service:latest [service] -> architect/backend/db:latest [postgres]',
      ])
      const api_node = graph.getNodeByRef('architect/backend/service:latest') as ServiceNode;
      expect(Object.entries(api_node.node_config.getEnvironmentVariables()).map(([k, v]) => `${k}=${v}`)).has.members([
        'POSTGRES_HOST=architect--backend--db--yptx6au8',
        'POSTGRES_PORT=5432',
        'POSTGRES_USER=postgres',
        'POSTGRES_PASSWORD=architect',
        'POSTGRES_DB=test_database'
      ])
    });
  });

  describe('extends dependencies', function () {
    it('chained extends', async () => {
      const service_config = {
        name: 'forked/payments-service',
        extends: 'architect/payments-service:v1'
      }

      moxios.stubRequest(`/accounts/forked/components/payments-service/versions/v1`, {
        status: 200,
        response: { tag: 'v1', config: service_config, service: { url: 'forked/payments-service:v1' } }
      });

      moxios.stubRequest(`/accounts/architect/components/payments-service/versions/v1`, {
        status: 200,
        response: { tag: 'v1', config: { name: 'architect/payments-service', parameters: { WORKED: 1 }, environment: { WORKED: '${ parameters.WORKED }' } }, service: { url: 'architect/payments-service:v1' } }
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
      const graph = await manager.getGraph();
      expect(graph.nodes).length(1);
      expect((graph.nodes[0] as ServiceNode).node_config.getEnvironmentVariables()).keys(['WORKED']);
      expect((graph.nodes[0] as ServiceNode).ref).eq('forked/payments-service/service:v1');
      // TODO: expect((graph.nodes[0] as ServiceNode).node_config.getImage()).eq('forked/payments-service/service:v1');
      expect(graph.edges).length(0);
    });

    it('check config refs', async () => {
      for (var i = 1; i < 4; i++) {
        moxios.stubRequest(`/accounts/architect/components/checkouts-service/versions/v` + i, {
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
      const graph = await manager.getGraph();
      expect(graph.nodes).length(3);
      expect(graph.edges).length(0);

      expect(graph.nodes[0].ref).eq('architect/checkouts-service/service:v1');
      expect(graph.nodes[1].ref).eq('architect/checkouts-service/service:v2');
      expect(graph.nodes[2].ref).eq('architect/checkouts-service/service:v3');
    });
  });
});
