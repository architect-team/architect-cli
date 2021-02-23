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
import PortUtil from '../../src/common/utils/port';
import { Refs, ServiceNode } from '../../src/dependency-manager/src';
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
        '/stack/environment.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.json');
      const graph = await manager.getGraph();
      expect(graph.nodes.map((n) => n.ref)).has.members([
        'architect/cloud/app:latest',
        'architect/cloud/api:latest',
      ])
      expect(graph.edges.map((e) => e.toString())).has.members([])

      const template = await DockerComposeUtils.generate(manager);
      expect(template).to.be.deep.equal({
        "services": {
          "architect--cloud--api--latest--zg9qionk": {
            "depends_on": [],
            "environment": {},
            "ports": [
              "50001:8080",
            ],
            "build": {
              "context": path.resolve("/stack")
            }
          },
          "architect--cloud--app--latest--kavtrukr": {
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
        '/stack/environment.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.json');
      expect(manager.environment.getComponents()['architect/cloud'].getRef()).eq('architect/cloud:v1')
      expect(manager.environment.getComponents()['architect/cloud'].getServiceRef('app')).eq('architect/cloud/app:v1')
      const graph = await manager.getGraph();
      expect(graph.nodes.map((n) => n.ref)).has.members([
        'architect/cloud/app:v1',
        'architect/cloud/api:v1',
      ])
      expect(graph.edges.map((e) => e.toString())).has.members([])
    });

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

      const env_config = {
        components: {
          'architect/cloud': {
            extends: 'v1',
            parameters: {
              log_level: 'debug'
            }
          }
        }
      };

      mock_fs({
        '/stack/environment.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.json');
      const graph = await manager.getGraph();
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

      const env_config = {
        components: {
          'architect/cloud': {
            'extends': 'file:.'
          }
        }
      };

      mock_fs({
        '/stack/architect.json': JSON.stringify(component_config),
        '/stack/environment.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.json');
      const graph = await manager.getGraph();
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
      expect(template).to.be.deep.equal({
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
        '/stack/environment.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.json');
      const graph = await manager.getGraph();

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

      const env_config = {
        components: {
          'examples/hello-world': {
            'extends': 'file:./architect.json'
          }
        }
      };

      mock_fs({
        '/stack/architect.json': JSON.stringify(component_config),
        '/stack/environment.json': JSON.stringify(env_config),
      });

      moxios.stubRequest(`/accounts/examples/components/hello-circular-world/versions/latest`, {
        status: 200,
        response: { tag: 'latest', config: circular_component_config, service: { url: 'examples/hello-circular-world:latest' } }
      });

      let manager_error;
      try {
        const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.json');
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

      const env_config = {
        components: {
          'examples/hello-world-a': {
            'extends': 'file:./architect.json'
          }
        }
      };

      mock_fs({
        '/stack/architect.json': JSON.stringify(component_config_a),
        '/stack/environment.json': JSON.stringify(env_config),
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
        const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.json');
        await manager.getGraph();
      } catch (err) {
        manager_error = err.message;
      }
      expect(manager_error).undefined;
    });

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

      const env_config = {
        components: {
          'architect/cloud': 'v1'
        }
      };

      mock_fs({
        '/stack/environment.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.json');
      expect(manager.environment.getComponents()['architect/cloud'].getRef()).eq('architect/cloud:v1')
      expect(manager.environment.getComponents()['architect/cloud'].getTaskRef('syncer')).eq('architect/cloud/syncer:v1')
      const graph = await manager.getGraph();
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

      const env_config = {
        components: {
          'architect/cloud': 'v1'
        }
      };

      mock_fs({
        '/stack/environment.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.json');
      expect(manager.environment.getComponents()['architect/cloud'].getRef()).eq('architect/cloud:v1')
      expect(manager.environment.getComponents()['architect/cloud'].getTaskRef('syncer')).eq('architect/cloud/syncer:v1')
      expect(manager.environment.getComponents()['architect/cloud'].getServiceRef('app')).eq('architect/cloud/app:v1')
      const graph = await manager.getGraph();
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

      const env_config = `
        parameters:
          test_required: foo
        components:
          examples/component-a: v1
          examples/component-b:
            extends: v2
            parameters:
              test_required: foo2
          examples/component-b:v1:
            parameters:
              test_required: foo3
      `;

      mock_fs({
        '/stack/environment.yml': env_config,
      });

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

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.yml');
      const graph = await manager.getGraph();

      const node_b_v1 = graph.getNodeByRef('examples/component-b/api:v1') as ServiceNode;
      expect(node_b_v1.node_config.getEnvironmentVariables().TEST_REQUIRED).to.eq('foo3');
      const node_b_v2 = graph.getNodeByRef('examples/component-b/api:v2') as ServiceNode;
      expect(node_b_v2.node_config.getEnvironmentVariables().TEST_REQUIRED).to.eq('foo2');
    });

    it('environment ingress context produces the correct values for external interfaces', async () => {
      const cloud_component_config = {
        name: 'architect/cloud',
        services: {
          api: {
            interfaces: {
              main: 8080
            },
            environment: {
              EXTERNAL_APP_URL: "${{ environment.ingresses['architect/cloud']['api-interface'].url }}",
              SELF_EXTERNAL_CI_URL: "${{ environment.ingresses['architect/cloud']['ci-interface'].url }}",
              EXTERNAL_CI_URL: "${{ environment.ingresses['concourse/ci']['actual-ci-interface'].url }}"
            }
          }
        },
        dependencies: {
          'concourse/ci': '6.2'
        },
        interfaces: {
          'api-interface': '${{ services.api.interfaces.main.url }}',
          'ci-interface': "${{ dependencies['concourse/ci'].interfaces.actual-ci-interface.url }}"
        }
      };

      const concourse_component_config = {
        name: 'concourse/ci',
        services: {
          web: {
            interfaces: {
              main: 8080,
            },
            image: 'concourse/concourse:6.2',
            environment: {
              EXTERNAL_CI_URL: "${{ environment.ingresses['concourse/ci']['actual-ci-interface'].url }}"
            }
          },
        },
        interfaces: {
          'actual-ci-interface': '${{ services.web.interfaces.main.url }}'
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
        },
        interfaces: {
          api: {
            url: "${{ components['architect/cloud'].interfaces.api-interface.url }}"
          },
          ci: {
            url: "${{ components['architect/cloud'].interfaces.ci-interface.url }}"
          }
        }
      };

      mock_fs({
        '/stack/cloud/architect.json': JSON.stringify(cloud_component_config),
        '/stack/concourse/architect.json': JSON.stringify(concourse_component_config),
        '/stack/environment.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.json');
      const graph = await manager.getGraph();

      expect(graph.edges.filter(e => e instanceof IngressEdge).length).eq(1);
      const ingress_edge = graph.edges.find(e => e instanceof IngressEdge);
      expect(ingress_edge!.interfaces_map).to.deep.equal({ api: 'api-interface', ci: 'ci-interface' });
      const cloud_api_node = graph.getNodeByRef('architect/cloud/api:latest') as ServiceNode;
      expect(cloud_api_node.node_config.getEnvironmentVariables()['EXTERNAL_APP_URL']).eq('http://api.localhost:80');
      expect(cloud_api_node.node_config.getEnvironmentVariables()['EXTERNAL_CI_URL']).eq('http://ci.localhost:80');
      expect(cloud_api_node.node_config.getEnvironmentVariables()['SELF_EXTERNAL_CI_URL']).eq('http://ci.localhost:80');
      const ci_web_node = graph.getNodeByRef('concourse/ci/web:6.2') as ServiceNode;
      expect(ci_web_node.node_config.getEnvironmentVariables()['EXTERNAL_CI_URL']).eq('http://ci.localhost:80');
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

      const env_config = {
        components: {
          'architect/cloud': {
            extends: 'file:./cloud'
          },
        },
        interfaces: {
          api: {
            url: "${{ components['architect/cloud'].interfaces.api-interface.url }}"
          },
        }
      };

      mock_fs({
        '/stack/cloud/architect.json': JSON.stringify(cloud_component_config),
        '/stack/environment.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.json');
      const graph = await manager.getGraph();

      expect(graph.edges.filter(e => e instanceof IngressEdge).length).eq(1);
      const ingress_edge = graph.edges.find(e => e instanceof IngressEdge);
      expect(ingress_edge!.interfaces_map).to.deep.equal({ api: 'api-interface' });
      const cloud_api_node = graph.getNodeByRef('architect/cloud/api:latest') as ServiceNode;
      expect(cloud_api_node.node_config.getEnvironmentVariables()['EXTERNAL_APP_URL']).eq('http://api.localhost:80');
    });

    it('environment ingress context produces the correct values for deep external interfaces', async () => {
      const cloud_component_config = {
        name: 'architect/cloud',
        services: {
          api: {
            interfaces: {
              main: 8080
            },
            environment: {
              EXTERNAL_APP_URL: "${{ environment.ingresses['architect/cloud']['api-interface'].url }}",
              SELF_EXTERNAL_CI_URL: "${{ environment.ingresses['architect/cloud']['ci-interface'].url }}",
              EXTERNAL_CI_URL: "${{ environment.ingresses['concourse/ci']['actual-ci-interface'].url }}",
              TOP_NESTED_INTERFACE_URL: "${{ environment.ingresses['architect/cloud']['top-nested-interface'].url }}"
            }
          }
        },
        dependencies: {
          'concourse/ci': '6.2'
        },
        interfaces: {
          'api-interface': '${{ services.api.interfaces.main.url }}',
          'ci-interface': "${{ dependencies['concourse/ci'].interfaces.actual-ci-interface.url }}",
          'top-nested-interface': "${{ dependencies['concourse/ci'].interfaces.nested-interface.url }}"
        }
      };

      const concourse_component_config = {
        name: 'concourse/ci',
        services: {
          web: {
            interfaces: {
              main: 8080,
            },
            image: 'concourse/concourse:6.2',
            environment: {
              EXTERNAL_CI_URL: "${{ environment.ingresses['concourse/ci']['actual-ci-interface'].url }}",
              DEEP_NESTED_URL: "${{ environment.ingresses['concourse/ci']['nested-interface'].url }}"
            }
          },
        },
        dependencies: {
          'deep/nested': '4.4'
        },
        interfaces: {
          'actual-ci-interface': '${{ services.web.interfaces.main.url }}',
          'nested-interface': "${{ dependencies['deep/nested'].interfaces.deep-nested-interface.url }}"
        }
      }

      const deep_nested_component_config = {
        name: 'deep/nested',
        services: {
          web: {
            interfaces: {
              main: 8080,
            },
            image: 'some/image:latest',
            environment: {
              EXTERNAL_DEEP_URL: "${{ environment.ingresses['deep/nested']['deep-nested-interface'].url }}"
            }
          },
        },
        interfaces: {
          'deep-nested-interface': '${{ services.web.interfaces.main.url }}'
        }
      }

      const env_config = {
        components: {
          'architect/cloud': {
            extends: 'file:./cloud'
          },
          'concourse/ci:6.2': {
            extends: 'file:./concourse/architect.json'
          },
          'deep/nested:4.4': {
            extends: 'file:./nested/architect.json'
          }
        },
        interfaces: {
          api: {
            url: "${{ components['architect/cloud'].interfaces.api-interface.url }}"
          },
          ci: {
            url: "${{ components['architect/cloud'].interfaces.ci-interface.url }}"
          },
          nested: {
            url: "${{ components['architect/cloud'].interfaces.top-nested-interface.url }}"
          }
        }
      };

      mock_fs({
        '/stack/cloud/architect.json': JSON.stringify(cloud_component_config),
        '/stack/concourse/architect.json': JSON.stringify(concourse_component_config),
        '/stack/nested/architect.json': JSON.stringify(deep_nested_component_config),
        '/stack/environment.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.json');
      const graph = await manager.getGraph();

      expect(graph.edges.filter(e => e instanceof IngressEdge).length).eq(1);
      const ingress_edge = graph.edges.find(e => e instanceof IngressEdge);
      expect(ingress_edge!.interfaces_map).to.deep.equal({ api: 'api-interface', ci: 'ci-interface', nested: 'top-nested-interface' });
      const cloud_api_node = graph.getNodeByRef('architect/cloud/api:latest') as ServiceNode;
      expect(cloud_api_node.node_config.getEnvironmentVariables()['EXTERNAL_APP_URL']).eq('http://api.localhost:80');
      expect(cloud_api_node.node_config.getEnvironmentVariables()['EXTERNAL_CI_URL']).eq('http://ci.localhost:80');
      expect(cloud_api_node.node_config.getEnvironmentVariables()['SELF_EXTERNAL_CI_URL']).eq('http://ci.localhost:80');
      expect(cloud_api_node.node_config.getEnvironmentVariables()['TOP_NESTED_INTERFACE_URL']).eq('http://nested.localhost:80');
      const ci_web_node = graph.getNodeByRef('concourse/ci/web:6.2') as ServiceNode;
      expect(ci_web_node.node_config.getEnvironmentVariables()['EXTERNAL_CI_URL']).eq('http://ci.localhost:80');
      expect(ci_web_node.node_config.getEnvironmentVariables()['DEEP_NESTED_URL']).eq('http://nested.localhost:80');
    });
  });
});
