import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Build from '../../src/commands/build';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';

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

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json', undefined, true);
      const graph = manager.graph;
      expect(graph.nodes).length(2);
      expect(graph.nodes.map((node) => node.ref)).members(['architect/frontend:latest', 'architect/backend:latest'])
      expect(graph.edges).length(1);
      expect(graph.edges.map((edge) => edge.ref)).members(['service.architect/frontend:latest.architect/backend:latest'])
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

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json', undefined, true);
      const graph = manager.graph;
      expect(graph.nodes).length(3);
      expect(graph.nodes.map((node) => node.ref)).members(['architect/service1:latest', 'architect/service2:latest', 'postgres/postgres:11'])
      expect(graph.edges).length(2);
      expect(graph.edges.map((edge) => edge.ref)).members(['service.architect/service1:latest.postgres/postgres:11', 'service.architect/service2:latest.postgres/postgres:11'])
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

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json', undefined, true);
      const graph = manager.graph;
      expect(graph.nodes).length(4);
      expect(graph.nodes.map((node) => node.ref)).members(['architect/service1:latest', 'architect/service2:latest', 'postgres/postgres:11', 'postgres/postgres:12'])
      expect(graph.edges).length(2);
      expect(graph.edges.map((edge) => edge.ref)).members(['service.architect/service1:latest.postgres/postgres:11', 'service.architect/service2:latest.postgres/postgres:12'])
    });
  });


  describe('inline dependencies', function () {
    it('simple frontend with inline backend dependency', async () => {
      const frontend_config = {
        name: 'architect/frontend',
        dependencies: {
          'architect/backend': {
            image: 'inline'
          }
        }
      };

      const env_config = {
        services: {
          'architect/frontend': {
            debug: {
              path: './src/frontend'
            }
          }
        }
      };

      mock_fs({
        '/stack/src/frontend/architect.json': JSON.stringify(frontend_config),
        '/stack/arc.env.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json', undefined, true);
      const graph = manager.graph;
      expect(graph.nodes).length(2);
      // TODO: scope ref
      expect(graph.nodes.map((node) => node.ref)).members(['architect/frontend:latest', 'TODO-architect/backend:latest'])
      expect(graph.edges).length(1);
      // TODO: scope ref
      expect(graph.edges.map((edge) => edge.ref)).members(['service.architect/frontend:latest.architect/backend:latest'])
    });

    it('two services that use different inline postgres dbs', async () => {
      const service_config1 = {
        name: 'architect/service1',
        dependencies: {
          'postgres/postgres': {
            image: 'postgres:11',
            parameters: {
              POSTGRES_DB: 'service1'
            }
          }
        }
      };

      const service_config2 = {
        name: 'architect/service2',
        dependencies: {
          'postgres/postgres': {
            image: 'postgres:11',
            parameters: {
              POSTGRES_DB: 'service2'
            }
          }
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

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json', undefined, true);
      const graph = manager.graph;
      expect(graph.nodes).length(4);
      // TODO: scope ref
      expect(graph.nodes.map((node) => node.ref)).members(['architect/service1:latest', 'architect/service2:latest', 'TODO-postgres/postgres:latest', 'TODO-postgres/postgres:latest'])
      expect(graph.edges).length(2);
      // TODO: scope ref
      expect(graph.edges.map((edge) => edge.ref)).members(['service.architect/service1:latest.postgres/postgres:11', 'service.architect/service2:latest.postgres/postgres:12'])
    });

    it('two services that use the same inline postgres db', async () => {
      const service_config1 = {
        name: 'architect/service1',
        dependencies: {
          'postgres/postgres': {
            image: 'postgres:11',
            parameters: {
              POSTGRES_DB: 'shared'
            }
          }
        }
      };

      const service_config2 = {
        name: 'architect/service2',
        dependencies: {
          'postgres/postgres': {
            image: 'postgres:11',
            parameters: {
              POSTGRES_DB: 'shared'
            }
          }
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

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json', undefined, true);
      const graph = manager.graph;
      expect(graph.nodes).length(3);
      // TODO: scope ref
      expect(graph.nodes.map((node) => node.ref)).members(['architect/service1:latest', 'architect/service2:latest', 'TODO-postgres/postgres:latest'])
      expect(graph.edges).length(2);
      // TODO: scope ref
      expect(graph.edges.map((edge) => edge.ref)).members(['service.architect/service1:latest.postgres/postgres:11', 'service.architect/service2:latest.postgres/postgres:12'])
    });

    it('two services that use the same inline postgres db X2', async () => {
      const service_config1 = {
        name: 'architect/service1',
        dependencies: {
          'postgres/postgres': {
            image: 'postgres:11',
            parameters: {
              POSTGRES_DB: 'shared'
            }
          }
        }
      };

      const service_config2 = {
        name: 'architect/service2',
        dependencies: {
          'postgres/postgres': {
            image: 'postgres:11',
            parameters: {
              POSTGRES_DB: 'shared'
            }
          }
        }
      };

      const service_config3 = {
        name: 'architect/service3',
        dependencies: {
          'postgres/postgres': {
            image: 'postgres:12',
            parameters: {
              POSTGRES_DB: 'shared'
            }
          }
        }
      };

      const service_config4 = {
        name: 'architect/service4',
        dependencies: {
          'postgres/postgres': {
            image: 'postgres:12',
            parameters: {
              POSTGRES_DB: 'shared'
            }
          }
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
          'architect/service3': {
            debug: {
              path: './src/service3'
            }
          },
          'architect/service4': {
            debug: {
              path: './src/service4'
            }
          },
        }
      };

      mock_fs({
        '/stack/src/service1/architect.json': JSON.stringify(service_config1),
        '/stack/src/service2/architect.json': JSON.stringify(service_config2),
        '/stack/src/service3/architect.json': JSON.stringify(service_config3),
        '/stack/src/service4/architect.json': JSON.stringify(service_config4),
        '/stack/arc.env.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json', undefined, true);
      const graph = manager.graph;
      expect(graph.nodes).length(6);
      // TODO: scope ref
      expect(graph.nodes.map((node) => node.ref)).members([
        'architect/service1:latest',
        'architect/service2:latest',
        'architect/service3:latest',
        'architect/service4:latest',
        'TODO1-postgres/postgres:latest',
        'TODO2-postgres/postgres:latest'
      ])
      expect(graph.edges).length(4);
      // TODO: scope ref
      expect(graph.edges.map((edge) => edge.ref)).members([
        'service.architect/service1:latest.postgres/postgres:latest',
        'service.architect/service2:latest.postgres/postgres:latest',
        'service.architect/service3:latest.postgres/postgres:latest',
        'service.architect/service4:latest.postgres/postgres:latest'
      ])
    });
  });


  describe('ref dependencies', function () {
    it('simple ref dependency', async () => {
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

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json', undefined, true);
      const graph = manager.graph;
      expect(graph.nodes).length(2);
      // TODO: scope ref
      expect(graph.nodes.map((node) => node.ref)).members(['architect/backend:latest', 'TODO-db:11'])
      expect(graph.edges).length(1);
      // TODO: scope ref
      expect(graph.edges.map((edge) => edge.ref)).members(['service.architect/frontend:latest.architect/backend:latest'])
    });

    // TODO add expanded ref test

    // TODO add ref test for https://gitlab.com/architect-io/product/-/issues/45#option-2-define-a-shared-service-in-an-env-config
  });
});
