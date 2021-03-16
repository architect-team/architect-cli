import { expect } from '@oclif/test';
import axios from 'axios';
import yaml from 'js-yaml';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import path from 'path';
import sinon from 'sinon';
import Register from '../../src/commands/register';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../../src/common/docker-compose';
import DockerComposeTemplate from '../../src/common/docker-compose/template';
import PortUtil from '../../src/common/utils/port';
import { ComponentConfigBuilder, ServiceNode } from '../../src/dependency-manager/src';
import IngressEdge from '../../src/dependency-manager/src/graph/edge/ingress';
import { TaskNode } from '../../src/dependency-manager/src/graph/node/task';

describe('components spec v1', function () {
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
      const component_config = ComponentConfigBuilder.buildFromJSON({
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
      });

      const manager = new LocalDependencyManager(axios.create());
      const graph = await manager.getGraph([component_config]);
      expect(graph.nodes.map((n) => n.ref)).has.members([
        'architect/cloud/app:latest',
        'architect/cloud/api:latest',
      ])
      expect(graph.edges.map((e) => e.toString())).has.members([])

      const template = await DockerComposeUtils.generate(graph);
      const expected_compose: DockerComposeTemplate = {
        "services": {
          "architect--cloud--api--latest--zg9qionk": {
            "environment": {},
            "ports": [
              "50001:8080",
            ],
            "build": {
              "context": path.resolve("/stack")
            }
          },
          "architect--cloud--app--latest--kavtrukr": {
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
      };
      if (process.platform === 'linux') {
        expected_compose.services['architect--cloud--app--latest--kavtrukr'].extra_hosts = [
          "host.docker.internal:host-gateway"
        ];
        expected_compose.services['architect--cloud--api--latest--zg9qionk'].extra_hosts = [
          "host.docker.internal:host-gateway"
        ];
      }
      expect(template).to.be.deep.equal(expected_compose);
    });

    it('simple remote component', async () => {
      const component_config_json = {
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
        response: { tag: 'v1', config: component_config_json, service: { url: 'architect/cloud:v1' } }
      });

      const manager = new LocalDependencyManager(axios.create());
      const component_config = await manager.loadComponentConfig('architect/cloud:v1');

      const graph = await manager.getGraph([component_config]);
      expect(graph.nodes.map((n) => n.ref)).has.members([
        'architect/cloud/app:v1',
        'architect/cloud/api:v1',
      ])
      expect(graph.edges.map((e) => e.toString())).has.members([])
    });

    /* TODO:207
    it('simple remote component with override', async () => {
      const component_config = {
        name: 'architect/cloud',
        parameters: {
          log_level: 'info'
        },
        services: {
          app: {
            interfaces: {
              main: 8080
            },
            environment: {
              LOG_LEVEL: '${{ parameters.log_level }}'
            }
          }
        }
      };

      moxios.stubRequest(`/accounts/architect/components/cloud/versions/v1`, {
        status: 200,
        response: { tag: 'v1', config: component_config, service: { url: 'architect/cloud:v1' } }
      });

      const manager = new LocalDependencyManager(axios.create());
      const graph = await manager.getGraph([]); // TODO:207
      expect(manager.environment.getComponents()['architect/cloud'].getRef()).eq('architect/cloud:v1')
      expect(manager.environment.getComponents()['architect/cloud'].getServiceRef('app')).eq('architect/cloud/app:v1')
      expect(graph.nodes.map((n) => n.ref)).has.members(['architect/cloud/app:v1'])
      expect(graph.edges.map((e) => e.toString())).has.members([])
      const app_node = graph.getNodeByRef('architect/cloud/app:v1') as ServiceNode;
      expect(app_node.node_config.getEnvironmentVariables().LOG_LEVEL).eq('debug')
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
              API_ADDR: '${{ services.api.interfaces.main.url }}'
            }
          },
          api: {
            interfaces: {
              main: 8080
            },
            environment: {
              DB_ADDR: '${{ services.db.interfaces.main.url }}'
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

      mock_fs({
        '/stack/architect.json': JSON.stringify(component_config),
      });

      const manager = new LocalDependencyManager(axios.create());
      const graph = await manager.getGraph([]); // TODO:207
      expect(graph.nodes.map((n) => n.ref)).has.members([
        'architect/cloud/app:latest',
        'architect/cloud/api:latest',
        'architect/cloud/db:latest'
      ])
      expect(graph.edges.map((e) => e.toString())).has.members([
        'architect/cloud/app:latest [service->main] -> architect/cloud/api:latest [main]',
        'architect/cloud/api:latest [service->main] -> architect/cloud/db:latest [main]'
      ])
      // Test parameter values
      const app_node = graph.getNodeByRef('architect/cloud/app:latest') as ServiceNode;

      const cloud_api_ref = Refs.url_safe_ref('architect/cloud/api:latest');
      expect(app_node.node_config.getEnvironmentVariables().API_ADDR).eq(`http://${cloud_api_ref}:8080`)

      const api_node = graph.getNodeByRef('architect/cloud/api:latest') as ServiceNode;
      const cloud_db_ref = Refs.url_safe_ref('architect/cloud/db:latest');
      expect(api_node.node_config.getEnvironmentVariables().DB_ADDR).eq(`http://${cloud_db_ref}:5432`)

      const template = await DockerComposeUtils.generate(manager);
      const expected_compose: DockerComposeTemplate = {
        "services": {
          "architect--cloud--api--latest--zg9qionk": {
            "depends_on": [
              `${cloud_db_ref}`
            ],
            "environment": {
              "DB_ADDR": `http://${cloud_db_ref}:5432`
            },
            "ports": [
              "50001:8080",
            ],
            "build": {
              "context": path.resolve("/stack")
            }
          },
          "architect--cloud--app--latest--kavtrukr": {
            "depends_on": [
              `${cloud_api_ref}`
            ],
            "environment": {
              "API_ADDR": `http://${cloud_api_ref}:8080`
            },
            "ports": [
              "50000:8080"
            ],
            "build": {
              "context": path.resolve("/stack")
            }
          },
          "architect--cloud--db--latest--6apzjzoe": {
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
      };
      if (process.platform === 'linux') {
        expected_compose.services['architect--cloud--app--latest--kavtrukr'].extra_hosts = [
          "host.docker.internal:host-gateway"
        ];
        expected_compose.services['architect--cloud--api--latest--zg9qionk'].extra_hosts = [
          "host.docker.internal:host-gateway"
        ];
        expected_compose.services['architect--cloud--db--latest--6apzjzoe'].extra_hosts = [
          "host.docker.internal:host-gateway"
        ];
      }
      expect(template).to.be.deep.equal(expected_compose);
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
              CONCOURSE_ADDR: '${{ dependencies.concourse/ci.interfaces.web.url }}'
            }
          }
        },
        dependencies: {
          'concourse/ci': '6.2'
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
              CONCOURSE_TSA_HOST: '${{ services.web.interfaces.main.host }}'
            }
          }
        },
        interfaces: {
          web: '${{ services.web.interfaces.main.url }}'
        }
      }

      mock_fs({
        '/stack/cloud/architect.json': JSON.stringify(cloud_component_config),
        '/stack/concourse/architect.json': JSON.stringify(concourse_component_config),
      });

      const manager = new LocalDependencyManager(axios.create());
      const graph = await manager.getGraph([]); // TODO:207

      expect(graph.nodes.map((n) => n.ref)).has.members([
        'architect/cloud/api:latest',

        'concourse/ci:6.2-interfaces',
        'concourse/ci/web:6.2',
        'concourse/ci/worker:6.2'
      ])
      expect(graph.edges.map((e) => e.toString())).has.members([
        'concourse/ci/worker:6.2 [service->main] -> concourse/ci/web:6.2 [main]',
        'concourse/ci:6.2-interfaces [web] -> concourse/ci/web:6.2 [main]',
        'architect/cloud/api:latest [service->web] -> concourse/ci:6.2-interfaces [web]'
      ])

      // Test parameter values
      const api_node = graph.getNodeByRef('architect/cloud/api:latest') as ServiceNode;
      const concourse_web_ref = Refs.url_safe_ref('concourse/ci/web:6.2');
      expect(api_node.node_config.getEnvironmentVariables().CONCOURSE_ADDR).eq(`http://${concourse_web_ref}:8080`)
      const worker_node = graph.getNodeByRef('concourse/ci/worker:6.2') as ServiceNode;
      expect(worker_node.node_config.getEnvironmentVariables().CONCOURSE_TSA_HOST).eq(concourse_web_ref);
    });

    it('circular component dependency is rejected', async () => {
      const component_config = {
        name: 'examples/hello-world',
        services: {
          api: {
            interfaces: {
              main: 8080
            }
          }
        },
        interfaces: {},
        dependencies: {
          'examples/hello-circular-world': 'latest'
        }
      };

      const circular_component_config = {
        name: 'examples/hello-circular-world',
        services: {
          api: {
            interfaces: {
              main: 8080
            }
          }
        },
        interfaces: {},
        dependencies: {
          'examples/hello-world': 'latest'
        }
      };

      mock_fs({
        '/stack/architect.json': JSON.stringify(component_config),
      });

      moxios.stubRequest(`/accounts/examples/components/hello-circular-world/versions/latest`, {
        status: 200,
        response: { tag: 'latest', config: circular_component_config, service: { url: 'examples/hello-circular-world:latest' } }
      });

      let manager_error;
      try {
        const manager = new LocalDependencyManager(axios.create());
        await manager.getGraph();
      } catch (err) {
        manager_error = err.message;
      }
      expect(manager_error).eq('Circular component dependency detected (examples/hello-circular-world:latest <> examples/hello-world:latest)');
    });

    it('non-circular component dependency is not rejected', async () => {
      const component_config_a = {
        name: 'examples/hello-world-a',
        services: {
          api: {
            interfaces: {
              main: 8080
            }
          }
        },
        interfaces: {},
        dependencies: {
          'examples/hello-world-b': 'latest',
          'examples/hello-world-c': 'latest'
        }
      };

      const component_config_b = {
        name: 'examples/hello-world-b',
        services: {
          api: {
            interfaces: {
              main: 8080
            }
          }
        },
        interfaces: {},
        dependencies: {
          'examples/hello-world-c': 'latest'
        }
      };

      const component_config_c = {
        name: 'examples/hello-world-c',
        services: {
          api: {
            interfaces: {
              main: 8080
            }
          }
        },
        interfaces: {},
        dependencies: {}
      };

      mock_fs({
        '/stack/architect.json': JSON.stringify(component_config_a),
      });

      moxios.stubRequest(`/accounts/examples/components/hello-world-b/versions/latest`, {
        status: 200,
        response: { tag: 'latest', config: component_config_b, service: { url: 'examples/hello-world-b:latest' } }
      });

      moxios.stubRequest(`/accounts/examples/components/hello-world-c/versions/latest`, {
        status: 200,
        response: { tag: 'latest', config: component_config_c, service: { url: 'examples/hello-world-c:latest' } }
      });

      let manager_error;
      try {
        const manager = new LocalDependencyManager(axios.create());
        await manager.getGraph();
      } catch (err) {
        manager_error = err.message;
      }
      expect(manager_error).undefined;
    });
    */

    it('component with one task', async () => {
      const component_config = {
        name: 'architect/cloud',
        tasks: {
          syncer: {
            schedule: '*/1 * * * *'
          },
        }
      };

      moxios.stubRequest(`/accounts/architect/components/cloud/versions/v1`, {
        status: 200,
        response: { tag: 'v1', config: component_config, service: { url: 'architect/cloud:v1' } }
      });

      const manager = new LocalDependencyManager(axios.create());
      const graph = await manager.getGraph([]); // TODO:207
      expect(graph.nodes.map((n) => n.ref)).has.members([
        'architect/cloud/syncer:v1',
      ])
      const task_node = graph.getNodeByRef('architect/cloud/syncer:v1');
      expect(task_node.__type).equals('task');
      expect((task_node as TaskNode).node_config.getSchedule()).equals('*/1 * * * *');

      expect(graph.edges.map((e) => e.toString())).has.members([])
    });

    it('component with one task and one service', async () => {
      const component_config = {
        name: 'architect/cloud',
        tasks: {
          syncer: {
            schedule: '*/1 * * * *'
          },
        },
        services: {
          app: {
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

      const manager = new LocalDependencyManager(axios.create());
      const graph = await manager.getGraph([]); // TODO:207
      expect(graph.nodes.map((n) => n.ref)).has.members([
        'architect/cloud/syncer:v1',
        'architect/cloud/app:v1',
      ])
      const task_node = graph.getNodeByRef('architect/cloud/syncer:v1');
      expect(task_node.__type).equals('task');
      expect((task_node as TaskNode).node_config.getSchedule()).equals('*/1 * * * *');

      expect(graph.edges.map((e) => e.toString())).has.members([])
    });

    it('component B:v2 and component A with dependency B:v1', async () => {
      // TODO: Validate lack of services/tasks
      // TODO: Validate lack of image/build context
      const component_a = `
        name: examples/component-a
        dependencies:
          examples/component-b: v1
        services:
          app:
            image: test:v1
        `;

      const component_b_v1 = `
        name: examples/component-b
        parameters:
          test_required:
        services:
          api:
            image: test:v1
            environment:
              TEST_REQUIRED: \${{ parameters.test_required }}
        `;

      const component_b_v2 = `
        name: examples/component-b
        parameters:
          test_required:
        services:
          api:
            image: test:v2
            environment:
              TEST_REQUIRED: \${{ parameters.test_required }}
        `;

      moxios.stubRequest(`/accounts/examples/components/component-a/versions/v1`, {
        status: 200,
        response: { tag: 'v1', config: yaml.safeLoad(component_a), service: { url: 'examples/component-a:v1' } }
      });
      moxios.stubRequest(`/accounts/examples/components/component-b/versions/v1`, {
        status: 200,
        response: { tag: 'v1', config: yaml.safeLoad(component_b_v1), service: { url: 'examples/component-b:v1' } }
      });
      moxios.stubRequest(`/accounts/examples/components/component-b/versions/v2`, {
        status: 200,
        response: { tag: 'v2', config: yaml.safeLoad(component_b_v2), service: { url: 'examples/component-b:v2' } }
      });

      const manager = new LocalDependencyManager(axios.create());
      const graph = await manager.getGraph([]);  // TODO:207

      const node_b_v1 = graph.getNodeByRef('examples/component-b/api:v1') as ServiceNode;
      expect(node_b_v1.node_config.getEnvironmentVariables().TEST_REQUIRED).to.eq('foo3');
      const node_b_v2 = graph.getNodeByRef('examples/component-b/api:v2') as ServiceNode;
      expect(node_b_v2.node_config.getEnvironmentVariables().TEST_REQUIRED).to.eq('foo2');
    });

    it('environment ingress context produces the correct values for a simple external interface', async () => {
      const cloud_component_config = {
        name: 'architect/cloud',
        services: {
          api: {
            interfaces: {
              main: 8080
            },
            environment: {
              EXTERNAL_APP_URL: "${{ environment.ingresses['architect/cloud']['api-interface'].url }}",
            }
          }
        },
        interfaces: {
          'api-interface': '${{ services.api.interfaces.main.url }}',
        }
      };

      mock_fs({
        '/stack/cloud/architect.json': JSON.stringify(cloud_component_config),
      });

      const manager = new LocalDependencyManager(axios.create());
      const graph = await manager.getGraph([]);  // TODO:207

      expect(graph.edges.filter(e => e instanceof IngressEdge).length).eq(1);
      const ingress_edge = graph.edges.find(e => e instanceof IngressEdge);
      expect(ingress_edge!.interfaces_map).to.deep.equal({ api: 'api-interface' });
      const cloud_api_node = graph.getNodeByRef('architect/cloud/api:latest') as ServiceNode;
      expect(cloud_api_node.node_config.getEnvironmentVariables()['EXTERNAL_APP_URL']).eq('http://api.localhost');
    });
  });
});
