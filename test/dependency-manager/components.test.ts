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
import { resourceRefToNodeRef, ServiceNode } from '../../src/dependency-manager/src';
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
      const component_config_yml = `
        name: architect/cloud
        services:
          app:
            interfaces:
              main: 8080
          api:
            interfaces:
              main: 8080
        interfaces:
      `

      mock_fs({
        '/stack/architect.yml': component_config_yml,
      });

      const manager = new LocalDependencyManager(axios.create(), {
        'architect/cloud': '/stack'
      });
      const graph = await manager.getGraph([
        await manager.loadComponentConfig('architect/cloud:latest')
      ]);

      const app_ref = resourceRefToNodeRef('architect/cloud/app:latest');
      const api_ref = resourceRefToNodeRef('architect/cloud/api:latest');

      expect(graph.nodes.map((n) => n.ref)).has.members([
        app_ref,
        api_ref,
      ])
      expect(graph.edges.map((e) => e.toString())).has.members([])

      const template = await DockerComposeUtils.generate(graph);
      const expected_compose: DockerComposeTemplate = {
        "services": {
          [app_ref]: {
            "environment": {},
            "ports": [
              "50000:8080",
            ],
            "build": {
              "context": path.resolve("/stack")
            }
          },
          [api_ref]: {
            "environment": {},
            "ports": [
              "50001:8080"
            ],
            "build": {
              "context": path.resolve("/stack")
            }
          },
        },
        "version": "3",
        "volumes": {},
      };
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
      const graph = await manager.getGraph([
        await manager.loadComponentConfig('architect/cloud:v1')
      ]);
      const app_ref = resourceRefToNodeRef('architect/cloud/app:v1');
      const api_ref = resourceRefToNodeRef('architect/cloud/api:v1');

      expect(graph.nodes.map((n) => n.ref)).has.members([
        app_ref,
        api_ref,
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

      const manager = new LocalDependencyManager(axios.create());
      const graph = await manager.getGraph([
        await manager.loadComponentConfig('architect/cloud:v1')
      ], { '*': { log_level: 'debug' } });
      const app_ref = resourceRefToNodeRef('architect/cloud/app:v1');
      expect(graph.nodes.map((n) => n.ref)).has.members([app_ref]);
      expect(graph.edges.map((e) => e.toString())).has.members([]);
      const app_node = graph.getNodeByRef(app_ref) as ServiceNode;
      expect(app_node.config.environment.LOG_LEVEL).eq('debug');
    });

    it('local component with edges', async () => {
      const component_config = {
        name: 'architect/cloud',
        services: {
          app: {
            interfaces: {
              main: 8080
            },
            depends_on: ['api'],
            environment: {
              API_ADDR: '${{ services.api.interfaces.main.url }}'
            }
          },
          api: {
            interfaces: {
              main: 8080
            },
            depends_on: ['db'],
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
        '/stack/architect.yml': yaml.dump(component_config),
      });

      const manager = new LocalDependencyManager(axios.create(), {
        'architect/cloud': '/stack/architect.yml'
      });
      const graph = await manager.getGraph([
        await manager.loadComponentConfig('architect/cloud:latest')
      ]);
      const app_ref = resourceRefToNodeRef('architect/cloud/app:latest');
      const api_ref = resourceRefToNodeRef('architect/cloud/api:latest');
      const db_ref = resourceRefToNodeRef('architect/cloud/db:latest');
      expect(graph.nodes.map((n) => n.ref)).has.members([
        app_ref,
        api_ref,
        db_ref
      ])
      expect(graph.edges.map((e) => e.toString())).has.members([
        `${app_ref} [service->main] -> ${api_ref} [main]`,
        `${api_ref} [service->main] -> ${db_ref} [main]`
      ])
      // Test parameter values
      const app_node = graph.getNodeByRef(app_ref) as ServiceNode;
      expect(app_node.config.environment.API_ADDR).eq(`http://${api_ref}:8080`)

      const api_node = graph.getNodeByRef(api_ref) as ServiceNode;
      expect(api_node.config.environment.DB_ADDR).eq(`http://${db_ref}:5432`)

      const template = await DockerComposeUtils.generate(graph);
      const expected_compose: DockerComposeTemplate = {
        "services": {
          [api_ref]: {
            "depends_on": [
              `${db_ref}`
            ],
            "environment": {
              "DB_ADDR": `http://${db_ref}:5432`
            },
            "ports": [
              "50001:8080",
            ],
            "build": {
              "context": path.resolve("/stack")
            }
          },
          [app_ref]: {
            "depends_on": [
              `${api_ref}`
            ],
            "environment": {
              "API_ADDR": `http://${api_ref}:8080`
            },
            "ports": [
              "50000:8080"
            ],
            "build": {
              "context": path.resolve("/stack")
            }
          },
          [db_ref]: {
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
        '/stack/cloud/architect.yml': yaml.dump(cloud_component_config),
        '/stack/concourse/architect.yml': yaml.dump(concourse_component_config),
      });

      const manager = new LocalDependencyManager(axios.create(), {
        'architect/cloud': '/stack/cloud/architect.yml',
        'concourse/ci': '/stack/concourse/architect.yml'
      });
      const component_config = await manager.loadComponentConfig('architect/cloud:latest');
      const graph = await manager.getGraph([
        ...await manager.loadComponentConfigs(component_config),
      ]);
      const api_ref = resourceRefToNodeRef('architect/cloud/api:latest');
      const ci_ref = resourceRefToNodeRef('concourse/ci:6.2');
      const web_ref = resourceRefToNodeRef('concourse/ci/web:6.2');
      const worker_ref = resourceRefToNodeRef('concourse/ci/worker:6.2');

      expect(graph.nodes.map((n) => n.ref)).has.members([
        api_ref,

        ci_ref,
        web_ref,
        worker_ref
      ])
      expect(graph.edges.map((e) => e.toString())).has.members([
        `${worker_ref} [service->main] -> ${web_ref} [main]`,
        `${ci_ref} [web] -> ${web_ref} [main]`,
        `${api_ref} [service->web] -> ${ci_ref} [web]`
      ])

      // Test parameter values
      const api_node = graph.getNodeByRef(api_ref) as ServiceNode;
      expect(api_node.config.environment.CONCOURSE_ADDR).eq(`http://${web_ref}:8080`)
      expect(api_node.config.name).to.eq('api');
      expect(api_node.config.tag).to.eq('latest');
      expect(api_node.config.ref).to.eq('architect/cloud/api:latest');
      const worker_node = graph.getNodeByRef(worker_ref) as ServiceNode;
      expect(worker_node.config.environment.CONCOURSE_TSA_HOST).eq(web_ref);
      expect(worker_node.config.name).to.eq('worker');
      expect(worker_node.config.tag).to.eq('6.2');
      expect(worker_node.config.ref).to.eq('concourse/ci/worker:6.2');
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
        '/stack/architect.yml': yaml.dump(component_config),
      });

      moxios.stubRequest(`/accounts/examples/components/hello-circular-world/versions/latest`, {
        status: 200,
        response: { tag: 'latest', config: circular_component_config, service: { url: 'examples/hello-circular-world:latest' } }
      });

      let manager_error;
      try {
        const manager = new LocalDependencyManager(axios.create(), {
          'examples/hello-world': '/stack/architect.yml',
        });
        await manager.getGraph([
          await manager.loadComponentConfig('examples/hello-world:latest'),
          await manager.loadComponentConfig('examples/hello-circular-world:latest'),
        ]);
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
        '/stack/architect.yml': yaml.dump(component_config_a),
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
        const manager = new LocalDependencyManager(axios.create(), {
          'examples/hello-world-a': '/stack/architect.yml',
        });
        await manager.getGraph([
          await manager.loadComponentConfig('examples/hello-world-a:latest'),
          await manager.loadComponentConfig('examples/hello-world-b:latest'),
          await manager.loadComponentConfig('examples/hello-world-c:latest')
        ]);
      } catch (err) {
        manager_error = err.message;
      }
      expect(manager_error).undefined;
    });

    it('component with only one task', async () => {
      const component_config_json = {
        name: 'architect/cloud',
        tasks: {
          syncer: {
            schedule: '*/1 * * * *'
          },
        }
      };

      moxios.stubRequest(`/accounts/architect/components/cloud/versions/v1`, {
        status: 200,
        response: { tag: 'v1', config: component_config_json, service: { url: 'architect/cloud:v1' } }
      });

      const manager = new LocalDependencyManager(axios.create());
      const component_config = await manager.loadComponentConfig('architect/cloud:v1');
      const graph = await manager.getGraph([component_config]);

      const syncer_ref = resourceRefToNodeRef('architect/cloud/syncer:v1');

      expect(graph.nodes.map((n) => n.ref)).has.members([
        syncer_ref,
      ])
      const task_node = graph.getNodeByRef(syncer_ref) as TaskNode;
      expect(task_node.__type).equals('task');
      expect(task_node.config.schedule).equals('*/1 * * * *');
      expect(task_node.config.name).equals('syncer');
      expect(task_node.config.ref).equals('architect/cloud/syncer:v1');

      expect(graph.edges.map((e) => e.toString())).has.members([])
    });

    it('component with one task and one service', async () => {
      const component_config_json = {
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
        response: { tag: 'v1', config: component_config_json, service: { url: 'architect/cloud:v1' } }
      });

      const manager = new LocalDependencyManager(axios.create());
      const component_config = await manager.loadComponentConfig('architect/cloud:v1');
      const graph = await manager.getGraph([component_config]);

      const syncer_ref = resourceRefToNodeRef('architect/cloud/syncer:v1');
      const app_ref = resourceRefToNodeRef('architect/cloud/app:v1');

      expect(graph.nodes.map((n) => n.ref)).has.members([
        syncer_ref,
        app_ref,
      ])
      const task_node = graph.getNodeByRef(syncer_ref) as TaskNode;
      expect(task_node.__type).equals('task');
      expect(task_node.config.schedule).equals('*/1 * * * *');
      expect(task_node.config.name).equals('syncer');

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
        response: { tag: 'v1', config: yaml.load(component_a), service: { url: 'examples/component-a:v1' } }
      });
      moxios.stubRequest(`/accounts/examples/components/component-b/versions/v1`, {
        status: 200,
        response: { tag: 'v1', config: yaml.load(component_b_v1), service: { url: 'examples/component-b:v1' } }
      });
      moxios.stubRequest(`/accounts/examples/components/component-b/versions/v2`, {
        status: 200,
        response: { tag: 'v2', config: yaml.load(component_b_v2), service: { url: 'examples/component-b:v2' } }
      });

      const manager = new LocalDependencyManager(axios.create());
      const graph = await manager.getGraph([
        await manager.loadComponentConfig('examples/component-a:v1'),
        await manager.loadComponentConfig('examples/component-b:v1'),
        await manager.loadComponentConfig('examples/component-b:v2')
      ], {
        '*': { test_required: 'foo1' },
        'examples/component-b:v1': {
          test_required: 'foo3'
        },
        'examples/component-b:v2': {
          test_required: 'foo2'
        }
      });

      const api_ref = resourceRefToNodeRef('examples/component-b/api:v1');
      const api2_ref = resourceRefToNodeRef('examples/component-b/api:v2');

      const node_b_v1 = graph.getNodeByRef(api_ref) as ServiceNode;
      expect(node_b_v1.config.environment.TEST_REQUIRED).to.eq('foo3');
      const node_b_v2 = graph.getNodeByRef(api2_ref) as ServiceNode;
      expect(node_b_v2.config.environment.TEST_REQUIRED).to.eq('foo2');
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
              EXTERNAL_APP_URL: "${{ ingresses['api-interface'].url }}",
              EXTERNAL_APP_URL2: "${{ environment.ingresses['architect/cloud']['api-interface'].url }}",
            }
          }
        },
        interfaces: {
          'api-interface': '${{ services.api.interfaces.main.url }}',
        }
      };

      mock_fs({
        '/stack/cloud/architect.yml': yaml.dump(cloud_component_config),
      });

      const manager = new LocalDependencyManager(axios.create(), { 'architect/cloud': '/stack/cloud/architect.yml' });
      const graph = await manager.getGraph([
        await manager.loadComponentConfig('architect/cloud:latest', { api: 'api-interface' })
      ]);

      const api_ref = resourceRefToNodeRef('architect/cloud/api:latest');

      expect(graph.edges.filter(e => e instanceof IngressEdge).length).eq(1);
      const ingress_edge = graph.edges.find(e => e instanceof IngressEdge);
      expect(ingress_edge!.interfaces_map).to.deep.equal({ api: 'api-interface' });
      const cloud_api_node = graph.getNodeByRef(api_ref) as ServiceNode;
      expect(cloud_api_node.config.environment['EXTERNAL_APP_URL']).eq('http://api.arc.localhost');
      expect(cloud_api_node.config.environment['EXTERNAL_APP_URL2']).eq('http://api.arc.localhost');
    });

    it('component with deep dependencies', async () => {
      const component_a = `
      name: examples/component-a
      dependencies:
        examples/component-b: latest
      services:
        app:
          image: test:v1
      `;

      const component_b = `
      name: examples/component-b
      dependencies:
        examples/component-c: latest
      services:
        api:
          image: test:v1
      `;

      const component_c = `
      name: examples/component-c
      services:
        api:
          image: test:v1
      `;

      mock_fs({
        '/a/architect.yaml': component_a,
        '/b/architect.yaml': component_b,
        '/c/architect.yaml': component_c,
      });

      const manager = new LocalDependencyManager(axios.create(), {
        'examples/component-a': '/a/architect.yaml',
        'examples/component-b': '/b/architect.yaml',
        'examples/component-c': '/c/architect.yaml'
      });
      const root_config = await manager.loadComponentConfig('examples/component-a');
      const graph = await manager.getGraph([
        root_config,
        ...await manager.loadComponentConfigs(root_config),
      ]);

      const a_ref = resourceRefToNodeRef('examples/component-a/app:latest');
      const b_ref = resourceRefToNodeRef('examples/component-b/api:latest');
      const c_ref = resourceRefToNodeRef('examples/component-c/api:latest');

      expect(graph.nodes.map((n) => n.ref)).has.members([
        a_ref,
        b_ref,
        c_ref
      ])
    });
  });
});
