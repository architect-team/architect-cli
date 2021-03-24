import { expect } from '@oclif/test';
import axios from 'axios';
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

describe('interfaces spec v1', () => {
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

  describe('leaf-branch', () => {
    let leaf_component = {} as any,
      branch_component = {} as any;

    beforeEach(async () => {
      leaf_component = {
        name: 'test/leaf',
        services: {
          db: {
            image: 'postgres:11',
            interfaces: {
              postgres: {
                port: 5432,
                protocol: 'postgres',
              },
            },
          },
          api: {
            image: 'api:latest',
            interfaces: {
              main: 8080
            },
            environment: {
              DB_PROTOCOL: '${{ services.db.interfaces.postgres.protocol }}',
              DB_HOST: '${{ services.db.interfaces.postgres.host }}',
              DB_PORT: '${{ services.db.interfaces.postgres.port }}',
              DB_URL: '${{ services.db.interfaces.postgres.url }}',
            },
          },
        },
        interfaces: {}
      };

      branch_component = {
        name: 'test/branch',
        dependencies: {
          'test/leaf': 'latest',
        },
        services: {
          api: {
            image: 'branch:latest',
            interfaces: {},
            environment: {
              LEAF_PROTOCOL: '${{ dependencies.test/leaf.interfaces.api.protocol }}',
              LEAF_HOST: '${{ dependencies.test/leaf.interfaces.api.host }}',
              LEAF_PORT: '${{ dependencies.test/leaf.interfaces.api.port }}',
              LEAF_URL: '${{ dependencies.test/leaf.interfaces.api.url }}',
            },
          },
        },
        interfaces: {}
      };
    });

    const test_branch_url_safe_ref = Refs.url_safe_ref('test/branch/api:latest');
    const test_leaf_db_latest_url_safe_ref = Refs.url_safe_ref('test/leaf/db:latest');
    const test_leaf_api_latest_url_safe_ref = Refs.url_safe_ref('test/leaf/api:latest');
    const test_leaf_db_v1_url_safe_ref = Refs.url_safe_ref('test/leaf/db:v1.0');
    const test_leaf_api_v1_url_safe_ref = Refs.url_safe_ref('test/leaf/api:v1.0');

    it('should connect two services together', async () => {
      mock_fs({
        '/stack/leaf/architect.json': JSON.stringify(leaf_component),
        '/stack/environment.json': JSON.stringify({
          components: {
            'test/leaf': 'file:/stack/leaf/',
          },
        }),
      });

      const manager = await LocalDependencyManager.createFromPath(
        axios.create(),
        '/stack/environment.json',
      );
      const graph = await manager.getGraph();
      expect(graph.nodes.map((n) => n.ref)).has.members([
        'test/leaf/db:latest',
        'test/leaf/api:latest'
      ])
      expect(graph.edges.map((e) => e.toString())).has.members([
        'test/leaf/api:latest [service->postgres] -> test/leaf/db:latest [postgres]',
      ])
      const api_node = graph.getNodeByRef('test/leaf/api:latest') as ServiceNode;
      expect(Object.entries(api_node.node_config.getEnvironmentVariables()).map(([k, v]) => `${k}=${v}`)).has.members([
        'DB_PROTOCOL=postgres',
        `DB_HOST=${test_leaf_db_latest_url_safe_ref}`,
        'DB_PORT=5432',
        `DB_URL=postgres://${test_leaf_db_latest_url_safe_ref}:5432`
      ])
    });

    it('should connect services to dependency interfaces', async () => {
      leaf_component.interfaces = {
        api: {
          url: '${{ services.api.interfaces.main.url }}',
        }
      };

      mock_fs({
        '/stack/leaf/architect.json': JSON.stringify(leaf_component),
        '/stack/branch/architect.json': JSON.stringify(branch_component),
        '/stack/environment.json': JSON.stringify({
          components: {
            'test/branch': 'file:/stack/branch/',
            'test/leaf': 'file:/stack/leaf/',
          },
        }),
      });

      const manager = await LocalDependencyManager.createFromPath(
        axios.create(),
        '/stack/environment.json',
      );
      const graph = await manager.getGraph();
      expect(graph.nodes.map((n) => n.ref)).has.members([
        'test/branch/api:latest',

        'test/leaf:latest-interfaces',
        'test/leaf/db:latest',
        'test/leaf/api:latest'
      ])
      expect(graph.edges.map((e) => e.toString())).has.members([
        'test/leaf/api:latest [service->postgres] -> test/leaf/db:latest [postgres]',
        'test/leaf:latest-interfaces [api] -> test/leaf/api:latest [main]',

        'test/branch/api:latest [service->api] -> test/leaf:latest-interfaces [api]',
      ])
      const branch_api_node = graph.getNodeByRef('test/branch/api:latest') as ServiceNode;

      expect(Object.entries(branch_api_node.node_config.getEnvironmentVariables()).map(([k, v]) => `${k}=${v}`)).has.members([
        'LEAF_PROTOCOL=http',
        `LEAF_HOST=${test_leaf_api_latest_url_safe_ref}`,
        'LEAF_PORT=8080',
        `LEAF_URL=http://${test_leaf_api_latest_url_safe_ref}:8080`
      ])
    });

    it('should expose environment interfaces via a gateway', async () => {
      leaf_component.interfaces = {
        api: '${{ services.api.interfaces.main.url }}',
      };

      mock_fs({
        '/stack/leaf/architect.json': JSON.stringify(leaf_component),
        '/stack/branch/architect.json': JSON.stringify(branch_component),
        '/stack/environment.json': JSON.stringify({
          interfaces: {
            public: '${{ components["test/leaf"].interfaces.api.url }}',
            publicv1: '${{ components["test/leaf:v1.0"].interfaces.api.url }}'
          },
          components: {
            'test/branch': 'file:/stack/branch/',
            'test/leaf': 'file:/stack/leaf/',
            'test/leaf:v1.0': 'file:/stack/leaf/',
          },
        }),
      });

      const manager = await LocalDependencyManager.createFromPath(
        axios.create(),
        '/stack/environment.json',
      );
      const graph = await manager.getGraph();

      expect(graph.nodes.map((n) => n.ref)).has.members([
        'gateway',

        'test/branch/api:latest',

        'test/leaf:latest-interfaces',
        'test/leaf/db:latest',
        'test/leaf/api:latest',

        'test/leaf:v1.0-interfaces',
        'test/leaf/db:v1.0',
        'test/leaf/api:v1.0',
      ])
      expect(graph.edges.map((e) => e.toString())).has.members([
        'gateway [public] -> test/leaf:latest-interfaces [api]',
        'gateway [publicv1] -> test/leaf:v1.0-interfaces [api]',

        'test/leaf/api:latest [service->postgres] -> test/leaf/db:latest [postgres]',
        'test/leaf:latest-interfaces [api] -> test/leaf/api:latest [main]',

        'test/leaf/api:v1.0 [service->postgres] -> test/leaf/db:v1.0 [postgres]',
        'test/leaf:v1.0-interfaces [api] -> test/leaf/api:v1.0 [main]',

        'test/branch/api:latest [service->api] -> test/leaf:latest-interfaces [api]',
      ])
      const branch_api_node = graph.getNodeByRef('test/branch/api:latest') as ServiceNode;
      expect(Object.entries(branch_api_node.node_config.getEnvironmentVariables()).map(([k, v]) => `${k}=${v}`)).has.members([
        'LEAF_PROTOCOL=http',
        'LEAF_HOST=public.arc.localhost',
        'LEAF_PORT=80',
        'LEAF_URL=http://public.arc.localhost:80'
      ])

      const template = await DockerComposeUtils.generate(manager);
      expect(Object.keys(template.services)).has.members([
        test_branch_url_safe_ref,
        test_leaf_db_latest_url_safe_ref,
        test_leaf_api_latest_url_safe_ref,
        test_leaf_db_v1_url_safe_ref,
        test_leaf_api_v1_url_safe_ref,
        'gateway'
      ])

      expect(template.services[test_branch_url_safe_ref]).to.be.deep.equal({
        depends_on: [test_leaf_api_latest_url_safe_ref],
        environment: {
          LEAF_HOST: 'public.arc.localhost',
          LEAF_PORT: '80',
          LEAF_PROTOCOL: 'http',
          LEAF_URL: 'http://public.arc.localhost:80'
        },
        image: 'branch:latest',
        external_links: [
          'gateway:public.arc.localhost',
          'gateway:publicv1.arc.localhost'
        ],
        ports: []
      });

      expect(template.services[test_leaf_db_latest_url_safe_ref]).to.be.deep.equal({
        depends_on: [],
        environment: {},
        image: 'postgres:11',
        ports: ['50000:5432'],
        external_links: [
          'gateway:public.arc.localhost',
          'gateway:publicv1.arc.localhost'
        ],
      });

      expect(template.services[test_leaf_api_latest_url_safe_ref]).to.be.deep.equal({
        depends_on: [test_leaf_db_latest_url_safe_ref, 'gateway'],
        environment: {
          DB_HOST: test_leaf_db_latest_url_safe_ref,
          DB_PORT: '5432',
          DB_PROTOCOL: 'postgres',
          DB_URL: `postgres://${test_leaf_db_latest_url_safe_ref}:5432`,
          VIRTUAL_HOST: 'public.arc.localhost',
          VIRTUAL_PORT: '8080',
          VIRTUAL_PORT_public_arc_localhost: '8080',
          VIRTUAL_PROTO: 'http'
        },
        image: 'api:latest',
        ports: ['50001:8080'],
        restart: 'always',
        external_links: [
          'gateway:public.arc.localhost',
          'gateway:publicv1.arc.localhost'
        ],
      });

      expect(template.services[test_leaf_db_v1_url_safe_ref]).to.be.deep.equal({
        depends_on: [],
        environment: {},
        image: 'postgres:11',
        ports: ['50002:5432'],
        external_links: [
          'gateway:public.arc.localhost',
          'gateway:publicv1.arc.localhost'
        ],
      });

      expect(template.services[test_leaf_api_v1_url_safe_ref]).to.be.deep.equal({
        depends_on: [test_leaf_db_v1_url_safe_ref, 'gateway'],
        environment: {
          DB_HOST: test_leaf_db_v1_url_safe_ref,
          DB_PORT: '5432',
          DB_PROTOCOL: 'postgres',
          DB_URL: `postgres://${test_leaf_db_v1_url_safe_ref}:5432`,
          VIRTUAL_HOST: 'publicv1.arc.localhost',
          VIRTUAL_PORT: '8080',
          VIRTUAL_PORT_publicv1_arc_localhost: '8080',
          VIRTUAL_PROTO: 'http'
        },
        image: 'api:latest',
        ports: ['50003:8080'],
        restart: 'always',
        external_links: [
          'gateway:public.arc.localhost',
          'gateway:publicv1.arc.localhost'
        ],
      });
    });
  });

  it('service with multiple public interfaces', async () => {
    const component_config = {
      name: 'architect/cloud',
      services: {
        api: {
          interfaces: {
            main: 8080,
            admin: 8081
          }
        },
      },
      interfaces: {
        app: '${{ services.api.interfaces.main.url }}',
        admin: '${{ services.api.interfaces.admin.url }}'
      }
    };

    const env_config = {
      interfaces: {
        app: '${{ components.architect/cloud.interfaces.app.url }}',
        admin: '${{ components.architect/cloud.interfaces.admin.url }}'
      },
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
      'gateway',
      'architect/cloud:latest-interfaces',
      'architect/cloud/api:latest',
    ])
    expect(graph.edges.map((e) => e.toString())).has.members([
      'architect/cloud:latest-interfaces [app, admin] -> architect/cloud/api:latest [main, admin]',
      'gateway [app, admin] -> architect/cloud:latest-interfaces [app, admin]'
    ])

    const architect_cloud_api_url_safe_ref = Refs.url_safe_ref('architect/cloud/api:latest');

    const template = await DockerComposeUtils.generate(manager);
    expect(template.services[architect_cloud_api_url_safe_ref]).to.be.deep.equal({
      "depends_on": ["gateway"],
      "environment": {
        "VIRTUAL_HOST": "app.arc.localhost,admin.arc.localhost",
        "VIRTUAL_PORT": "8081",
        "VIRTUAL_PORT_admin_arc_localhost": "8081",
        "VIRTUAL_PORT_app_arc_localhost": "8080",
        "VIRTUAL_PROTO": "http"
      },
      "external_links": [
        "gateway:app.arc.localhost",
        "gateway:admin.arc.localhost"
      ],
      "ports": [
        "50000:8080",
        "50001:8081"
      ],
      "build": {
        "context": path.resolve("/stack")
      },
      "restart": "always"
    });
  });

  it('using multiple ports from a dependency', async () => {
    const admin_ui_config = `
      name: voic/admin-ui
      dependencies:
        voic/product-catalog: latest
      interfaces:
        dep: \${{ dependencies['voic/product-catalog'].interfaces.public.url }}
      services:
        dashboard:
          interfaces:
            main: 3000
          environment:
            API_ADDR: \${{ dependencies['voic/product-catalog'].interfaces.public.url }}
            ADMIN_ADDR: \${{ dependencies['voic/product-catalog'].interfaces.admin.url }}
            PRIVATE_ADDR: \${{ dependencies['voic/product-catalog'].interfaces.private.url }}
      `;

    const product_catalog_config = `
      name: voic/product-catalog
      services:
        db:
          interfaces:
            pg:
              port: 5432
              protocol: postgres
        api:
          interfaces:
            public: 8080
            admin: 8081
            private: 8082
      interfaces:
        public: \${{ services.api.interfaces.public.url }}
        admin: \${{ services.api.interfaces.admin.url }}
        private: \${{ services.api.interfaces.private.url }}
    `;

    const env_config = `
      components:
        voic/admin-ui:
          extends: file:./admin-ui
        voic/product-catalog:
          extends: file:./product-catalog
      interfaces:
        public2: \${{ components.voic/product-catalog.interfaces.public.url }}
        admin2: \${{ components.voic/product-catalog.interfaces.admin.url }}
        dep2: \${{ components.voic/admin-ui.interfaces.dep.url }}
    `;

    mock_fs({
      '/stack/product-catalog/architect.yml': product_catalog_config,
      '/stack/admin-ui/architect.yml': admin_ui_config,
      '/stack/environment.yml': env_config,
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.yml');
    const graph = await manager.getGraph();
    expect(graph.edges.map(e => e.toString())).members([
      'voic/product-catalog:latest-interfaces [public, admin, private] -> voic/product-catalog/api:latest [public, admin, private]',
      'voic/admin-ui/dashboard:latest [service->public, service->admin, service->private] -> voic/product-catalog:latest-interfaces [public, admin, private]',
      'voic/admin-ui:latest-interfaces [dep] -> voic/product-catalog:latest-interfaces [public]',
      'gateway [public2, admin2] -> voic/product-catalog:latest-interfaces [public, admin]',
      'gateway [dep2] -> voic/admin-ui:latest-interfaces [dep]'
    ])

    const ingress_edges = graph.edges.filter((edge) => edge instanceof IngressEdge);

    const ingress_edge = ingress_edges[0];
    const [node_to, node_to_interface_name] = graph.followEdge(ingress_edge, 'public2');
    expect(node_to).instanceOf(ServiceNode);
    expect(node_to_interface_name).to.eq('public');

    const [node_to2, node_to_interface_name2] = graph.followEdge(ingress_edge, 'admin2');
    expect(node_to2).instanceOf(ServiceNode);
    expect(node_to_interface_name2).to.eq('admin');

    const dashboard_node = graph.getNodeByRef('voic/admin-ui/dashboard:latest') as ServiceNode;
    expect(dashboard_node.node_config.getEnvironmentVariables()).to.deep.eq({
      ADMIN_ADDR: 'http://admin2.arc.localhost:80',
      API_ADDR: 'http://public2.arc.localhost:80',
      PRIVATE_ADDR: 'http://voic--product-catalog--api--latest--afhqqu3p:8082'
    });

    const [node_to3, node_to_interface_name3] = graph.followEdge(ingress_edges[1], 'dep2');
    expect(node_to3).instanceOf(ServiceNode);
    expect(node_to_interface_name3).to.eq('public');

    const template = await DockerComposeUtils.generate(manager);
    expect(template.services[Refs.url_safe_ref('voic/product-catalog/api:latest')].environment).to.deep.eq({
      VIRTUAL_HOST: 'public2.arc.localhost,admin2.arc.localhost,dep2.arc.localhost',
      VIRTUAL_PORT_public2_arc_localhost: '8080',
      VIRTUAL_PORT: '8080',
      VIRTUAL_PROTO: 'http',
      VIRTUAL_PORT_admin2_arc_localhost: '8081',
      VIRTUAL_PORT_dep2_arc_localhost: '8080'
    })
  });
});
