import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Build from '../../src/commands/build';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import * as DockerCompose from '../../src/common/docker-compose';
import PortUtil from '../../src/common/utils/port';
import { ServiceNode } from '../../src/dependency-manager/src';

describe('components spec v1', function () {
  beforeEach(async () => {
    // Stub the logger
    sinon.replace(Build.prototype, 'log', sinon.stub());
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
      expect(graph.nodes).length(2);
      expect(graph.nodes[0].ref).eq('architect/cloud/app:latest')
      expect(graph.nodes[1].ref).eq('architect/cloud/api:latest')
      expect(graph.edges).length(0);

      const template = await DockerCompose.generate(manager);
      expect(template).to.be.deep.equal({
        "services": {
          "architect.cloud.api.latest": {
            "depends_on": [],
            "environment": {
              "HOST": "architect.cloud.api.latest",
              "PORT": "8080"
            },
            "ports": [
              "50001:8080",
            ],
          },
          "architect.cloud.app.latest": {
            "depends_on": [],
            "environment": {
              "HOST": "architect.cloud.app.latest",
              "PORT": "8080"
            },
            "ports": [
              "50000:8080"
            ]
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

      moxios.stubRequest(`/accounts/architect/services/cloud/versions/v1`, {
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
      expect(graph.nodes).length(2);
      expect(graph.nodes[0].ref).eq('architect/cloud/app:latest')
      expect(graph.nodes[1].ref).eq('architect/cloud/api:latest')
      expect(graph.edges).length(0);
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
      expect(graph.nodes).length(3);
      expect(graph.nodes[0].ref).eq('architect/cloud/app:latest')
      expect(graph.nodes[1].ref).eq('architect/cloud/api:latest')
      expect(graph.nodes[2].ref).eq('architect/cloud/db:latest')
      expect(graph.edges).length(2);
      expect(graph.edges[0].from).eq('architect/cloud/app:latest')
      expect(graph.edges[0].to).eq('architect/cloud/api:latest')
      expect(graph.edges[1].from).eq('architect/cloud/api:latest')
      expect(graph.edges[1].to).eq('architect/cloud/db:latest')
      // Test parameter values
      expect((graph.nodes[0] as ServiceNode).node_config.getEnvironmentVariables().API_ADDR).eq('http://architect.cloud.api.latest:8080')
      expect((graph.nodes[1] as ServiceNode).node_config.getEnvironmentVariables().DB_ADDR).eq('http://architect.cloud.db.latest:5432')

      const template = await DockerCompose.generate(manager);
      expect(template).to.be.deep.equal({
        "services": {
          "architect.cloud.api.latest": {
            "depends_on": [
              "architect.cloud.db.latest"
            ],
            "environment": {
              "DB_ADDR": "http://architect.cloud.db.latest:5432",
              "HOST": "architect.cloud.api.latest",
              "PORT": "8080"
            },
            "ports": [
              "50001:8080",
            ],
          },
          "architect.cloud.app.latest": {
            "depends_on": [
              "architect.cloud.api.latest"
            ],
            "environment": {
              "API_ADDR": "http://architect.cloud.api.latest:8080",
              "HOST": "architect.cloud.app.latest",
              "PORT": "8080"
            },
            "ports": [
              "50000:8080"
            ]
          },
          "architect.cloud.db.latest": {
            "depends_on": [],
            "environment": {
              "HOST": "architect.cloud.db.latest",
              "PORT": "5432"
            },
            "ports": [
              "50002:5432"
            ],
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
      expect(graph.nodes).length(4);
      expect(graph.nodes[0].ref).eq('architect/cloud/api:latest')
      expect(graph.nodes[1].ref).eq('concourse/ci:6.2-interfaces')
      expect(graph.nodes[2].ref).eq('concourse/ci/web:6.2')
      expect(graph.nodes[3].ref).eq('concourse/ci/worker:6.2')
      const api_node = graph.nodes[0] as ServiceNode;
      const worker_node = graph.nodes[3] as ServiceNode;

      expect(graph.edges).length(3);
      expect(graph.edges[0].from).eq('concourse/ci/worker:6.2')
      expect(graph.edges[0].to).eq('concourse/ci/web:6.2')
      expect(graph.edges[1].from).eq('concourse/ci:6.2-interfaces')
      expect(graph.edges[1].to).eq('concourse/ci/web:6.2')
      expect(graph.edges[2].from).eq('architect/cloud/api:latest')
      expect(graph.edges[2].to).eq('concourse/ci:6.2-interfaces')

      // Test parameter values
      expect(api_node.node_config.getEnvironmentVariables().CONCOURSE_ADDR).eq('http://concourse.ci.web.6.2:8080')
      expect(worker_node.node_config.getEnvironmentVariables().CONCOURSE_TSA_HOST).eq('concourse.ci.web.6.2')
    });
  });
});
