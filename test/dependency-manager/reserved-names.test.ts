import { expect } from '@oclif/test';
import axios from 'axios';
import yaml from 'js-yaml';
import mock_fs from 'mock-fs';
import nock from 'nock';
import path from 'path';
import { IngressEdge, resourceRefToNodeRef, ServiceNode } from '../../src';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../../src/common/docker-compose';
import DockerComposeTemplate from '../../src/common/docker-compose/template';

describe('components with reserved_name field set', function () {
  describe('standard components with reserved name', function () {
    it('simple local component', async () => {
      const reserved_name = 'test-name';
      const component_config_yml = `
        name: architect/cloud
        services:
          app:
            interfaces:
              main: 8080
          api:
            interfaces:
              main: 8080
            reserved_name: ${reserved_name}
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
      const api_ref = reserved_name;

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
            },
            labels: ['architect.ref=architect/cloud.services.app']
          },
          [api_ref]: {
            "environment": {},
            "ports": [
              "50001:8080"
            ],
            "build": {
              "context": path.resolve("/stack")
            },
            labels: [`architect.ref=${reserved_name}`]
          },
        },
        "version": "3",
        "volumes": {},
      };
      expect(template).to.be.deep.equal(expected_compose);
    });

    // it('simple local component with interpolated reserved name', async () => {
    //   const full_reserved_name = 'test-name-api';
    //   const component_config_yml = `
    //     name: architect/cloud
    //     secrets:
    //       name_override:
    //         default: test-name
    //     services:
    //       api:
    //         interfaces:
    //           main: 8080
    //         reserved_name: \${{ secrets.name_override }}-api
    //   `

    //   mock_fs({
    //     '/stack/architect.yml': component_config_yml,
    //   });

    //   const manager = new LocalDependencyManager(axios.create(), {
    //     'architect/cloud': '/stack'
    //   });

    //   const graph = await manager.getGraph([
    //     await manager.loadComponentSpec('architect/cloud:latest')
    //   ]);

    //   const api_ref = full_reserved_name;

    //   expect(graph.nodes.map((n) => n.ref)).has.members([
    //     api_ref,
    //   ])
    //   expect(graph.edges.map((e) => e.toString())).has.members([])

    //   const template = await DockerComposeUtils.generate(graph);
    //   const expected_compose: DockerComposeTemplate = {
    //     "services": {
    //       [api_ref]: {
    //         "environment": {},
    //         "ports": [
    //           "50000:8080"
    //         ],
    //         "build": {
    //           "context": path.resolve("/stack")
    //         },
    //         labels: [`architect.ref=${full_reserved_name}`]
    //       },
    //     },
    //     "version": "3",
    //     "volumes": {},
    //   };
    //   expect(template).to.be.deep.equal(expected_compose);
    // });

    it('simple remote component', async () => {
      const reserved_name = 'test-name';
      const component_config_json = {
        name: 'architect/cloud',
        services: {
          app: {
            interfaces: {
              main: 8080
            },
            reserved_name,
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
      const app_ref = reserved_name;
      const api_ref = resourceRefToNodeRef('architect/cloud.services.api');

      expect(graph.nodes.map((n) => n.ref)).has.members([
        app_ref,
        api_ref,
      ])
      expect(graph.edges.map((e) => e.toString())).has.members([])
    });

    it('simple remote component with override', async () => {
      const reserved_name = 'test-name';
      const component_config = {
        name: 'architect/cloud',
        secrets: {
          log_level: 'info'
        },
        services: {
          app: {
            interfaces: {
              main: 8080
            },
            environment: {
              LOG_LEVEL: '${{ secrets.log_level }}'
            },
            reserved_name,
          }
        }
      };

      nock('http://localhost').get(`/accounts/architect/components/cloud/versions/v1`)
        .reply(200, { tag: 'v1', config: component_config, service: { url: 'architect/cloud:v1' } });

      const manager = new LocalDependencyManager(axios.create());
      const graph = await manager.getGraph([
        await manager.loadComponentSpec('architect/cloud:v1')
      ], { '*': { log_level: 'debug' } });
      const app_ref = reserved_name;
      expect(graph.nodes.map((n) => n.ref)).has.members([app_ref]);
      expect(graph.edges.map((e) => e.toString())).has.members([]);
      const app_node = graph.getNodeByRef(app_ref) as ServiceNode;
      expect(app_node.config.environment.LOG_LEVEL).eq('debug');
    });

    it('local component with edges', async () => {
      const reserved_name = 'test-name';
      const component_config = {
        name: 'architect/cloud',
        services: {
          app: {
            interfaces: {
              main: 8080
            },
            depends_on: [reserved_name],
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
            },
            reserved_name,
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
      const api_ref = reserved_name;
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
            },
            labels: [`architect.ref=${api_ref}`]
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
            },
            labels: ['architect.ref=architect/cloud.services.app']
          },
          [db_ref]: {
            "environment": {},
            "ports": [
              "50002:5432"
            ],
            "build": {
              "context": path.resolve("/stack")
            },
            labels: ['architect.ref=architect/cloud.services.db']
          }
        },
        "version": "3",
        "volumes": {},
      };
      expect(template).to.be.deep.equal(expected_compose);
    });

    it('local component with local dependency', async () => {
      const reserved_name = 'test-name';
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
            },
            reserved_name,
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
      const worker_ref = reserved_name;

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
      expect(worker_node.config.name).to.eq(reserved_name);
      expect(worker_node.config.metadata.tag).to.eq('6.2');
      expect(worker_node.config.metadata.ref).to.eq(reserved_name);
    });

    it('environment ingress context produces the correct values for a simple external interface', async () => {
      const reserved_name = 'test-name';
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
            },
            reserved_name,
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

      expect(graph.edges.filter(e => e instanceof IngressEdge).length).eq(1);
      const ingress_edge = graph.edges.find(e => e instanceof IngressEdge);
      expect(ingress_edge!.interface_mappings).to.deep.equal([{ interface_from: 'api', interface_to: 'api-interface' }]);
      const cloud_api_node = graph.getNodeByRef(reserved_name) as ServiceNode;
      expect(cloud_api_node.config.environment['EXTERNAL_APP_URL']).eq('http://api.arc.localhost');
      expect(cloud_api_node.config.environment['EXTERNAL_APP_URL2']).eq('http://api.arc.localhost');
    });

    it('component with deep dependencies', async () => {
      const reserved_name = 'test-name';
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
          reserved_name: ${reserved_name}
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
      const b_ref = reserved_name;
      const c_ref = resourceRefToNodeRef('examples/component-c.services.api');

      expect(graph.nodes.map((n) => n.ref)).has.members([
        a_ref,
        b_ref,
        c_ref
      ])
    });

    it('components with shared dependencies', async () => {
      const reserved_name = 'test-name';
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
          reserved_name: ${reserved_name}
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
      const c_ref = reserved_name;

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
  });
});
