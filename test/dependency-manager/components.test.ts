import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import path from 'path';
import sinon from 'sinon';
import Register from '../../src/commands/register';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import * as DockerCompose from '../../src/common/docker-compose';
import PortUtil from '../../src/common/utils/port';
import { ServiceNode } from '../../src/dependency-manager/src';

describe('components spec v1', function () {
  beforeEach(async () => {
    // Stub the logger
    sinon.replace(Register.prototype, 'log', sinon.stub());
    moxios.install();
    sinon.replace(PortUtil, 'isPortAvailable', async () => true);
    PortUtil.reset();
  });

  afterEach(function () {
    // Restore stubs
    sinon.restore();
    // Restore fs
    mock_fs.restore();
    moxios.uninstall();
  });

  describe('standard components', function () {
    it('simple local component', async () => {
      const component_config = {
        name: 'architect/cloud',
        services: {
          app: {
            interfaces: {
              main: 8080
            }
          },
          api: {
            interfaces: {
              main: 8080
            }
          }
        },
        interfaces: {}
      };

      const env_config = {
        components: {
          'architect/cloud': {
            'extends': 'file:.'
          }
        }
      };

      mock_fs({
        '/stack/architect.json': JSON.stringify(component_config),
        '/stack/arc.env.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
      const graph = await manager.getGraph();
      expect(graph.nodes.map((n) => n.ref)).has.members([
        'architect/cloud/app:latest',
        'architect/cloud/api:latest',
      ])
      expect(graph.edges.map((e) => e.toString())).has.members([])

      const template = await DockerCompose.generate(manager);
      expect(template).to.be.deep.equal({
        "services": {
          "architect.cloud.api.latest": {
            "depends_on": [],
            "environment": {},
            "ports": [
              "50001:8080",
            ],
            "build": {
              "context": path.resolve("/stack")
            }
          },
          "architect.cloud.app.latest": {
            "depends_on": [],
            "environment": {},
            "ports": [
              "50000:8080"
            ],
            "build": {
              "context": path.resolve("/stack")
            }
          },
        },
        "version": "3",
        "volumes": {},
      })
    });

    it('simple remote component', async () => {
      const component_config = {
        name: 'architect/cloud',
        services: {
          app: {
            interfaces: {
              main: 8080
            }
          },
          api: {
            interfaces: {
              main: 8080
            }
          }
        }
      };

      moxios.stubRequest(`/accounts/architect/components/cloud/versions/v1`, {
        status: 200,
        response: { tag: 'v1', config: component_config, service: { url: 'architect/cloud:v1' } }
      });

      const env_config = {
        components: {
          'architect/cloud': 'v1'
        }
      };

      mock_fs({
        '/stack/arc.env.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
      const graph = await manager.getGraph();
      expect(graph.nodes.map((n) => n.ref)).has.members([
        'architect/cloud/app:latest',
        'architect/cloud/api:latest',
      ])
      expect(graph.edges.map((e) => e.toString())).has.members([])
    });

    it('local component with edges', async () => {
      const component_config = {
        name: 'architect/cloud',
        services: {
          app: {
            interfaces: {
              main: 8080
            },
            environment: {
              API_ADDR: '${ services.api.interfaces.main.url }'
            }
          },
          api: {
            interfaces: {
              main: 8080
            },
            environment: {
              DB_ADDR: '${ services.db.interfaces.main.url }'
            }
          },
          db: {
            interfaces: {
              main: 5432
            }
          }
        },
        interfaces: {}
      };

      const env_config = {
        components: {
          'architect/cloud': {
            'extends': 'file:.'
          }
        }
      };

      mock_fs({
        '/stack/architect.json': JSON.stringify(component_config),
        '/stack/arc.env.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
      const graph = await manager.getGraph();
      expect(graph.nodes.map((n) => n.ref)).has.members([
        'architect/cloud/app:latest',
        'architect/cloud/api:latest',
        'architect/cloud/db:latest'
      ])
      expect(graph.edges.map((e) => e.toString())).has.members([
        'architect/cloud/app:latest [service] -> architect/cloud/api:latest [main]',
        'architect/cloud/api:latest [service] -> architect/cloud/db:latest [main]'
      ])
      // Test parameter values
      const app_node = graph.getNodeByRef('architect/cloud/app:latest') as ServiceNode;
      expect(app_node.node_config.getEnvironmentVariables().API_ADDR).eq('http://architect.cloud.api.latest:8080')
      const api_node = graph.getNodeByRef('architect/cloud/api:latest') as ServiceNode;
      expect(api_node.node_config.getEnvironmentVariables().DB_ADDR).eq('http://architect.cloud.db.latest:5432')

      const template = await DockerCompose.generate(manager);
      expect(template).to.be.deep.equal({
        "services": {
          "architect.cloud.api.latest": {
            "depends_on": [
              "architect.cloud.db.latest"
            ],
            "environment": {
              "DB_ADDR": "http://architect.cloud.db.latest:5432"
            },
            "ports": [
              "50001:8080",
            ],
            "build": {
              "context": path.resolve("/stack")
            }
          },
          "architect.cloud.app.latest": {
            "depends_on": [
              "architect.cloud.api.latest"
            ],
            "environment": {
              "API_ADDR": "http://architect.cloud.api.latest:8080"
            },
            "ports": [
              "50000:8080"
            ],
            "build": {
              "context": path.resolve("/stack")
            }
          },
          "architect.cloud.db.latest": {
            "depends_on": [],
            "environment": {},
            "ports": [
              "50002:5432"
            ],
            "build": {
              "context": path.resolve("/stack")
            }
          }
        },
        "version": "3",
        "volumes": {},
      })
    });

    it('local component with local dependency', async () => {
      const cloud_component_config = {
        name: 'architect/cloud',
        services: {
          api: {
            interfaces: {
              main: 8080
            },
            environment: {
              CONCOURSE_ADDR: '${ dependencies.concourse/ci.interfaces.web.url }'
            }
          }
        },
        dependencies: {
          'concourse/ci': 6.2
        },
        interfaces: {}
      };

      const concourse_component_config = {
        name: 'concourse/ci',
        services: {
          web: {
            interfaces: {
              main: 8080,
            },
            image: 'concourse/concourse:6.2'
          },
          worker: {
            interfaces: {},
            image: 'concourse/concourse:6.2',
            environment: {
              CONCOURSE_TSA_HOST: '${ services.web.interfaces.main.host }'
            }
          }
        },
        interfaces: {
          web: '${ services.web.interfaces.main.url }'
        }
      }

      const env_config = {
        components: {
          'architect/cloud': {
            extends: 'file:./cloud'
          },
          'concourse/ci:6.2': {
            extends: 'file:./concourse/architect.json'
          }
        }
      };

      mock_fs({
        '/stack/cloud/architect.json': JSON.stringify(cloud_component_config),
        '/stack/concourse/architect.json': JSON.stringify(concourse_component_config),
        '/stack/arc.env.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
      const graph = await manager.getGraph();

      expect(graph.nodes.map((n) => n.ref)).has.members([
        'architect/cloud/api:latest',

        'concourse/ci:6.2-interfaces',
        'concourse/ci/web:6.2',
        'concourse/ci/worker:6.2'
      ])
      expect(graph.edges.map((e) => e.toString())).has.members([
        'concourse/ci/worker:6.2 [service] -> concourse/ci/web:6.2 [main]',
        'concourse/ci:6.2-interfaces [web] -> concourse/ci/web:6.2 [main]',
        'architect/cloud/api:latest [service] -> concourse/ci:6.2-interfaces [web]'
      ])

      // Test parameter values
      const api_node = graph.getNodeByRef('architect/cloud/api:latest') as ServiceNode;
      expect(api_node.node_config.getEnvironmentVariables().CONCOURSE_ADDR).eq('http://concourse.ci.web.6.2:8080')
      const worker_node = graph.getNodeByRef('concourse/ci/worker:6.2') as ServiceNode;
      expect(worker_node.node_config.getEnvironmentVariables().CONCOURSE_TSA_HOST).eq('concourse.ci.web.6.2')
    });
  });
});
