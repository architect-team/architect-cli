import { expect } from '@oclif/test';
import axios from 'axios';
import yaml from 'js-yaml';
import mock_fs from 'mock-fs';
import nock from 'nock';
import path from 'path';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../../src/common/docker-compose';
import DockerComposeTemplate from '../../src/common/docker-compose/template';
import { resourceRefToNodeRef, ServiceNode } from '../../src/dependency-manager/src';
import IngressEdge from '../../src/dependency-manager/src/graph/edge/ingress';
import { TaskNode } from '../../src/dependency-manager/src/graph/node/task';

describe('components spec v1', function () {
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
      `

      mock_fs({
        '/stack/architect.yml': component_config_yml,
      });

      const manager = new LocalDependencyManager(axios.create(), {
        'architect/cloud': '/stack'
      });
      const graph = await manager.getGraph([
        await manager.loadComponentSpec('architect/cloud:latest')
      ]);

      const app_ref = resourceRefToNodeRef('architect/cloud.services.app');
      const api_ref = resourceRefToNodeRef('architect/cloud.services.api');

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

      nock('http://localhost').get(`/accounts/architect/components/cloud/versions/v1`)
        .reply(200, { tag: 'v1', config: component_config_json, service: { url: 'architect/cloud:v1' } });

      const manager = new LocalDependencyManager(axios.create());
      const graph = await manager.getGraph([
        await manager.loadComponentSpec('architect/cloud:v1')
      ]);
      const app_ref = resourceRefToNodeRef('architect/cloud.services.app');
      const api_ref = resourceRefToNodeRef('architect/cloud.services.api');

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

      nock('http://localhost').get(`/accounts/architect/components/cloud/versions/v1`)
        .reply(200, { tag: 'v1', config: component_config, service: { url: 'architect/cloud:v1' } });

      const manager = new LocalDependencyManager(axios.create());
      const graph = await manager.getGraph([
        await manager.loadComponentSpec('architect/cloud:v1')
      ], { '*': { log_level: 'debug' } });
      const app_ref = resourceRefToNodeRef('architect/cloud.services.app');
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
        await manager.loadComponentSpec('architect/cloud:latest')
      ]);
      const app_ref = resourceRefToNodeRef('architect/cloud.services.app');
      const api_ref = resourceRefToNodeRef('architect/cloud.services.api');
      const db_ref = resourceRefToNodeRef('architect/cloud.services.db');
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
        name: 'cloud',
        services: {
          api: {
            interfaces: {
              main: 8080
            },
            environment: {
              CONCOURSE_ADDR: '${{ dependencies.ci.interfaces.web.url }}'
            }
          }
        },
        dependencies: {
          'ci': '6.2'
        },
        interfaces: {}
      };

      const concourse_component_config = {
        name: 'ci',
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
        'cloud': '/stack/cloud/architect.yml',
        'ci': '/stack/concourse/architect.yml'
      });
      const graph = await manager.getGraph([
        ...await manager.loadComponentSpecs('cloud:latest'),
      ]);
      const api_ref = resourceRefToNodeRef('cloud.services.api');
      const ci_ref = resourceRefToNodeRef('ci');
      const web_ref = resourceRefToNodeRef('ci.services.web');
      const worker_ref = resourceRefToNodeRef('ci.services.worker');

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
      expect(api_node.config.metadata.tag).to.eq('latest');
      expect(api_node.config.metadata.ref).to.eq('cloud.services.api');
      const worker_node = graph.getNodeByRef(worker_ref) as ServiceNode;
      expect(worker_node.config.environment.CONCOURSE_TSA_HOST).eq(web_ref);
      expect(worker_node.config.name).to.eq('worker');
      expect(worker_node.config.metadata.tag).to.eq('6.2');
      expect(worker_node.config.metadata.ref).to.eq('ci.services.worker');
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
          'examples/hello-world2': 'latest'
        }
      };

      const component_config2 = {
        name: 'examples/hello-world2',
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

      nock('http://localhost').get(`/accounts/examples/components/hello-world2/versions/latest`)
        .reply(200, { tag: 'latest', config: component_config2, service: { url: 'examples/hello-world2:latest' } });

      nock('http://localhost').get(`/accounts/examples/components/hello-circular-world/versions/latest`)
        .reply(200, { tag: 'latest', config: circular_component_config, service: { url: 'examples/hello-circular-world:latest' } });

      let manager_error;
      try {
        const manager = new LocalDependencyManager(axios.create(), {
          'examples/hello-world': '/stack/architect.yml',
        });
        await manager.getGraph([
          await manager.loadComponentSpec('examples/hello-world:latest'),
          await manager.loadComponentSpec('examples/hello-world2:latest'),
          await manager.loadComponentSpec('examples/hello-circular-world:latest'),
        ]);
      } catch (err: any) {
        manager_error = err.message;
      }
      expect(manager_error).eq('Circular component dependency detected (examples/hello-circular-world <> examples/hello-world <> examples/hello-world2)');
    });

    it('non-circular component dependency is not rejected', async () => {
      const component_config_a = {
        name: 'hello-world-a',
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
          'hello-world-c': 'latest'
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
          'hello-world-c': 'latest'
        }
      };

      const component_config_c = {
        name: 'hello-world-c',
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

      nock('http://localhost').get(`/accounts/examples/components/hello-world-b/versions/latest`)
        .reply(200, { tag: 'latest', config: component_config_b, service: { url: 'examples/hello-world-b:latest' } });

      nock('http://localhost').get(`/accounts/examples/components/hello-world-c/versions/latest`)
        .reply(200, { tag: 'latest', config: component_config_c, service: { url: 'examples/hello-world-c:latest' } });

      const manager = new LocalDependencyManager(axios.create(), {
        'hello-world-a': '/stack/architect.yml',
      });
      manager.account = 'examples';
      await manager.getGraph(await manager.loadComponentSpecs('hello-world-a:latest'));
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

      nock('http://localhost').get(`/accounts/architect/components/cloud/versions/v1`)
        .reply(200, { tag: 'v1', config: component_config_json, service: { url: 'architect/cloud:v1' } });

      const manager = new LocalDependencyManager(axios.create());
      const component_config = await manager.loadComponentSpec('architect/cloud:v1');
      const graph = await manager.getGraph([component_config]);

      const syncer_ref = resourceRefToNodeRef('architect/cloud.tasks.syncer');

      expect(graph.nodes.map((n) => n.ref)).has.members([
        syncer_ref,
      ])
      const task_node = graph.getNodeByRef(syncer_ref) as TaskNode;
      expect(task_node.__type).equals('task');
      expect(task_node.config.schedule).equals('*/1 * * * *');
      expect(task_node.config.name).equals('syncer');
      expect(task_node.config.metadata.ref).equals('architect/cloud.tasks.syncer');

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

      nock('http://localhost').get(`/accounts/architect/components/cloud/versions/v1`)
        .reply(200, { tag: 'v1', config: component_config_json, service: { url: 'architect/cloud:v1' } });

      const manager = new LocalDependencyManager(axios.create());
      const component_config = await manager.loadComponentSpec('architect/cloud:v1');
      const graph = await manager.getGraph([component_config]);

      const syncer_ref = resourceRefToNodeRef('architect/cloud.tasks.syncer');
      const app_ref = resourceRefToNodeRef('architect/cloud.services.app');

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

      nock('http://localhost').get(`/accounts/examples/components/component-a/versions/v1`)
        .reply(200, { tag: 'v1', config: yaml.load(component_a), service: { url: 'examples/component-a:v1' } });

      nock('http://localhost').get(`/accounts/examples/components/component-b/versions/v1`)
        .reply(200, { tag: 'v1', config: yaml.load(component_b_v1), service: { url: 'examples/component-b:v1' } });

      nock('http://localhost').get(`/accounts/examples/components/component-b/versions/v2`)
        .reply(200, { tag: 'v2', config: yaml.load(component_b_v2), service: { url: 'examples/component-b:v2' } });

      const manager = new LocalDependencyManager(axios.create());
      const graph = await manager.getGraph([
        await manager.loadComponentSpec('examples/component-a:v1'),
        await manager.loadComponentSpec('examples/component-b:v1'),
        await manager.loadComponentSpec('examples/component-b:v2@v2')
      ], {
        '*': { test_required: 'foo1' },
        'examples/component-b': {
          test_required: 'foo3'
        },
        'examples/component-b@v2': {
          test_required: 'foo2'
        }
      });

      const api_ref = resourceRefToNodeRef('examples/component-b.services.api');
      const api2_ref = resourceRefToNodeRef('examples/component-b.services.api@v2');

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
        await manager.loadComponentSpec('architect/cloud:latest', { interfaces: { api: 'api-interface' } })
      ]);

      const api_ref = resourceRefToNodeRef('architect/cloud.services.api');

      expect(graph.edges.filter(e => e instanceof IngressEdge).length).eq(1);
      const ingress_edge = graph.edges.find(e => e instanceof IngressEdge);
      expect(ingress_edge!.interface_mappings).to.deep.equal([{ interface_from: 'api', interface_to: 'api-interface' }]);
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
      const graph = await manager.getGraph([
        ...await manager.loadComponentSpecs('examples/component-a'),
      ]);

      const a_ref = resourceRefToNodeRef('examples/component-a.services.app');
      const b_ref = resourceRefToNodeRef('examples/component-b.services.api');
      const c_ref = resourceRefToNodeRef('examples/component-c.services.api');

      expect(graph.nodes.map((n) => n.ref)).has.members([
        a_ref,
        b_ref,
        c_ref
      ])
    });

    it('components with shared dependencies', async () => {
      const component_a = `
      name: examples/component-a
      dependencies:
        examples/component-c: latest
      services:
        app:
          image: test:v1
          environment:
            C_ADDR: \${{ dependencies.examples/component-c.interfaces.api.url }}
            C_EXT_ADDR: \${{ dependencies.examples/component-c.ingresses.api.url }}
      `;

      const component_b = `
      name: examples/component-b
      dependencies:
        examples/component-c: latest
      services:
        api:
          image: test:v1
          environment:
            C_ADDR: \${{ dependencies.examples/component-c.interfaces.api.url }}
            C_EXT_ADDR: \${{ dependencies.examples/component-c.ingresses.api.url }}
      `;

      const component_c = `
      name: examples/component-c
      services:
        api:
          image: test:v1
          interfaces:
            main: 8080
      interfaces:
        api: \${{ services.api.interfaces.main.url }}
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
      const graph = await manager.getGraph([
        ...await manager.loadComponentSpecs('examples/component-a'),
        ...await manager.loadComponentSpecs('examples/component-b'),
      ]);

      const a_ref = resourceRefToNodeRef('examples/component-a.services.app');
      const b_ref = resourceRefToNodeRef('examples/component-b.services.api');
      const c_ref = resourceRefToNodeRef('examples/component-c.services.api');

      const a_node = graph.getNodeByRef(a_ref) as ServiceNode;
      expect(a_node.config.environment).to.deep.equal({
        C_ADDR: `http://${c_ref}:8080`,
        C_EXT_ADDR: `http://api.arc.localhost`
      })

      const b_node = graph.getNodeByRef(b_ref) as ServiceNode;
      expect(b_node.config.environment).to.deep.equal({
        C_ADDR: `http://${c_ref}:8080`,
        C_EXT_ADDR: `http://api.arc.localhost`
      })
    });

    it('validation does not run if validate is set to false', async () => {
      const component_config_yml = `
        name: architect/cloud
        parameters:
          app_replicas:
            default: 1
        services:
          app:
            interfaces:
              main: 8080
            replicas: \${{ parameters.app_replicas }}
      `

      mock_fs({
        '/stack/architect.yml': component_config_yml,
      });

      const manager = new LocalDependencyManager(axios.create(), {
        'architect/cloud': '/stack'
      });
      const config = await manager.loadComponentSpec('architect/cloud:latest');

      await manager.getGraph([config], { '*': { app_replicas: '<redacted>' } }, true, false);
    });
  });
});
