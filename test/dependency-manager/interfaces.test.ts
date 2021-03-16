import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import path from 'path';
import sinon from 'sinon';
import Register from '../../src/commands/register';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../../src/common/docker-compose';
import { DockerService } from '../../src/common/docker-compose/template';
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

    it('should connect two services together', async () => {
      mock_fs({
        '/stack/leaf/architect.json': JSON.stringify(leaf_component),
      });

      const manager = new LocalDependencyManager(axios.create());
      const graph = await manager.getGraph([]); // TODO:207
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
      });

      const manager = new LocalDependencyManager(axios.create());
      const graph = await manager.getGraph([]); // TODO:207
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
      branch_component.services.api.environment.EXTERNAL_INTERFACE = "${{ environment.ingresses['test/leaf']['api'].url }}";

      const other_leaf_component = {
        name: 'test/other-leaf',
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
        interfaces: {
          api: '${{ services.api.interfaces.main.url }}',
        }
      };

      const test_leaf_db_other_url_safe_ref = Refs.url_safe_ref('test/other-leaf/db:latest');
      const test_leaf_api_other_url_safe_ref = Refs.url_safe_ref('test/other-leaf/api:latest');

      mock_fs({
        '/stack/leaf/architect.json': JSON.stringify(leaf_component),
        '/stack/branch/architect.json': JSON.stringify(branch_component),
        '/stack/other-leaf/architect.json': JSON.stringify(other_leaf_component),
      });

      const manager = new LocalDependencyManager(axios.create());
      const graph = await manager.getGraph([]); // TODO:207

      expect(graph.nodes.map((n) => n.ref)).has.members([
        'gateway',

        'test/branch/api:latest',

        'test/leaf:latest-interfaces',
        'test/leaf/db:latest',
        'test/leaf/api:latest',

        'test/other-leaf:latest-interfaces',
        'test/other-leaf/db:latest',
        'test/other-leaf/api:latest',
      ])
      expect(graph.edges.map((e) => e.toString())).has.members([
        'gateway [public] -> test/leaf:latest-interfaces [api]',
        'gateway [publicv1] -> test/other-leaf:latest-interfaces [api]',

        'test/leaf/api:latest [service->postgres] -> test/leaf/db:latest [postgres]',
        'test/leaf:latest-interfaces [api] -> test/leaf/api:latest [main]',

        'test/other-leaf/api:latest [service->postgres] -> test/other-leaf/db:latest [postgres]',
        'test/other-leaf:latest-interfaces [api] -> test/other-leaf/api:latest [main]',

        'test/branch/api:latest [service->api] -> test/leaf:latest-interfaces [api]',
      ])
      const branch_api_node = graph.getNodeByRef('test/branch/api:latest') as ServiceNode;
      expect(Object.entries(branch_api_node.node_config.getEnvironmentVariables()).map(([k, v]) => `${k}=${v}`)).has.members([
        'LEAF_PROTOCOL=http',
        'LEAF_HOST=test--leaf--api--latest--lw4iacyc',
        'LEAF_PORT=8080',
        'LEAF_URL=http://test--leaf--api--latest--lw4iacyc:8080',
        'EXTERNAL_INTERFACE=http://public.localhost',
      ])

      const template = await DockerComposeUtils.generate(graph);
      expect(Object.keys(template.services)).has.members([
        test_branch_url_safe_ref,
        test_leaf_db_latest_url_safe_ref,
        test_leaf_api_latest_url_safe_ref,
        test_leaf_db_other_url_safe_ref,
        test_leaf_api_other_url_safe_ref,
        'gateway'
      ]);

      const expected_leaf_compose: DockerService = {
        depends_on: [test_leaf_api_latest_url_safe_ref],
        environment: {
          LEAF_HOST: 'test--leaf--api--latest--lw4iacyc',
          LEAF_PORT: '8080',
          LEAF_PROTOCOL: 'http',
          LEAF_URL: 'http://test--leaf--api--latest--lw4iacyc:8080',
          EXTERNAL_INTERFACE: 'http://public.localhost'
        },
        image: 'branch:latest',
        external_links: [
          'gateway:public.localhost',
          'gateway:publicv1.localhost'
        ],
        ports: []
      };
      if (process.platform === 'linux') {
        expected_leaf_compose.extra_hosts = [
          "host.docker.internal:host-gateway"
        ];
      }
      expect(template.services[test_branch_url_safe_ref]).to.be.deep.equal(expected_leaf_compose);

      const expected_leaf_db_compose: DockerService = {
        environment: {},
        image: 'postgres:11',
        ports: ['50000:5432'],
        external_links: [
          'gateway:public.localhost',
          'gateway:publicv1.localhost'
        ],
      };
      if (process.platform === 'linux') {
        expected_leaf_db_compose.extra_hosts = [
          "host.docker.internal:host-gateway"
        ];
      }
      expect(template.services[test_leaf_db_latest_url_safe_ref]).to.be.deep.equal(expected_leaf_db_compose);

      const expected_leaf_api_compose: DockerService = {
        depends_on: [test_leaf_db_latest_url_safe_ref],
        environment: {
          DB_HOST: test_leaf_db_latest_url_safe_ref,
          DB_PORT: '5432',
          DB_PROTOCOL: 'postgres',
          DB_URL: `postgres://${test_leaf_db_latest_url_safe_ref}:5432`
        },
        "labels": [
          "traefik.enable=true",
          "traefik.http.routers.public.rule=Host(`public.localhost`)",
          "traefik.http.routers.public.service=public-service",
          "traefik.http.services.public-service.loadbalancer.server.port=8080",
          "traefik.http.services.public-service.loadbalancer.server.scheme=http"
        ],
        image: 'api:latest',
        ports: ['50001:8080'],
        restart: 'always',
        external_links: [
          'gateway:public.localhost',
          'gateway:publicv1.localhost'
        ],
      };
      if (process.platform === 'linux') {
        expected_leaf_api_compose.extra_hosts = [
          "host.docker.internal:host-gateway"
        ];
      }
      expect(template.services[test_leaf_api_latest_url_safe_ref]).to.be.deep.equal(expected_leaf_api_compose);

      const expected_other_leaf_db_compose: DockerService = {
        environment: {},
        image: 'postgres:11',
        ports: ['50002:5432'],
        external_links: [
          'gateway:public.localhost',
          'gateway:publicv1.localhost'
        ],
      };
      if (process.platform === 'linux') {
        expected_other_leaf_db_compose.extra_hosts = [
          "host.docker.internal:host-gateway"
        ];
      }
      expect(template.services[test_leaf_db_other_url_safe_ref]).to.be.deep.equal(expected_other_leaf_db_compose);

      const expected_other_leaf_api_compose: DockerService = {
        depends_on: [test_leaf_db_other_url_safe_ref],
        environment: {
          DB_HOST: test_leaf_db_other_url_safe_ref,
          DB_PORT: '5432',
          DB_PROTOCOL: 'postgres',
          DB_URL: `postgres://${test_leaf_db_other_url_safe_ref}:5432`
        },
        "labels": [
          "traefik.enable=true",
          "traefik.http.routers.publicv1.rule=Host(`publicv1.localhost`)",
          "traefik.http.routers.publicv1.service=publicv1-service",
          "traefik.http.services.publicv1-service.loadbalancer.server.port=8080",
          "traefik.http.services.publicv1-service.loadbalancer.server.scheme=http"
        ],
        image: 'api:latest',
        ports: ['50003:8080'],
        restart: 'always',
        external_links: [
          'gateway:public.localhost',
          'gateway:publicv1.localhost'
        ],
      };
      if (process.platform === 'linux') {
        expected_other_leaf_api_compose.extra_hosts = [
          "host.docker.internal:host-gateway"
        ];
      }
      expect(template.services[test_leaf_api_other_url_safe_ref]).to.be.deep.equal(expected_other_leaf_api_compose);
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

    mock_fs({
      '/stack/architect.json': JSON.stringify(component_config),
    });

    const manager = new LocalDependencyManager(axios.create());
    const graph = await manager.getGraph([]); // TODO:207
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

    const template = await DockerComposeUtils.generate(graph);
    const expected_compose: DockerService = {
      "environment": {},
      "labels": [
        "traefik.enable=true",
        "traefik.http.routers.app.rule=Host(`app.localhost`)",
        "traefik.http.routers.app.service=app-service",
        "traefik.http.services.app-service.loadbalancer.server.port=8080",
        "traefik.http.services.app-service.loadbalancer.server.scheme=http",
        "traefik.http.routers.admin.rule=Host(`admin.localhost`)",
        "traefik.http.routers.admin.service=admin-service",
        "traefik.http.services.admin-service.loadbalancer.server.port=8081",
        "traefik.http.services.admin-service.loadbalancer.server.scheme=http"
      ],
      "external_links": [
        "gateway:app.localhost",
        "gateway:admin.localhost"
      ],
      "ports": [
        "50000:8080",
        "50001:8081"
      ],
      "build": {
        "context": path.resolve("/stack")
      },
      "restart": "always"
    };
    if (process.platform === 'linux') {
      expected_compose.extra_hosts = [
        "host.docker.internal:host-gateway"
      ];
    }
    expect(template.services[architect_cloud_api_url_safe_ref]).to.be.deep.equal(expected_compose);
  });

  it('using multiple ports from a dependency', async () => {
    const admin_ui_config = `
      name: voic/admin-ui
      dependencies:
        voic/product-catalog: latest
      services:
        dashboard:
          interfaces:
            main: 3000
          environment:
            API_ADDR: \${{ dependencies['voic/product-catalog'].interfaces.public.url }}
            ADMIN_ADDR: \${{ dependencies['voic/product-catalog'].interfaces.admin.url }}
            PRIVATE_ADDR: \${{ dependencies['voic/product-catalog'].interfaces.private.url }}
            EXTERNAL_API_ADDR: \${{ environment.ingresses['voic/product-catalog']['public'].url }}
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

    mock_fs({
      '/stack/product-catalog/architect.yml': product_catalog_config,
      '/stack/admin-ui/architect.yml': admin_ui_config,
    });

    const manager = new LocalDependencyManager(axios.create());
    const graph = await manager.getGraph([]); // TODO:207
    expect(graph.edges.map(e => e.toString())).members([
      'voic/product-catalog:latest-interfaces [public, admin, private] -> voic/product-catalog/api:latest [public, admin, private]',
      'voic/admin-ui/dashboard:latest [service->public, service->admin, service->private] -> voic/product-catalog:latest-interfaces [public, admin, private]',
      'gateway [public2, admin2] -> voic/product-catalog:latest-interfaces [public, admin]',
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
      ADMIN_ADDR: 'http://voic--product-catalog--api--latest--afhqqu3p:8081',
      API_ADDR: 'http://voic--product-catalog--api--latest--afhqqu3p:8080',
      PRIVATE_ADDR: 'http://voic--product-catalog--api--latest--afhqqu3p:8082',
      EXTERNAL_API_ADDR: 'http://public2.localhost',
    });
  });

  it('should support HTTP basic auth', async () => {
    const smtp_config = `
      name: architect/smtp
      services:
        maildev:
          image: maildev/maildev
          interfaces:
            smtp:
              port: 1025
              protocol: smtp
              username: test-user
              password: test-pass
            dashboard: 1080
        test-app:
          image: hashicorp/http-echo
          environment:
            SMTP_ADDR: \${{ services.maildev.interfaces.smtp.url }}
            SMTP_USER: \${{ services.maildev.interfaces.smtp.username }}
            SMTP_PASS: \${{ services.maildev.interfaces.smtp.password }}
    `;

    mock_fs({
      '/stack/smtp/architect.yml': smtp_config,
    });

    const manager = new LocalDependencyManager(axios.create());
    const graph = await manager.getGraph([]); // TODO:207

    const test_node = graph.getNodeByRef('architect/smtp/test-app:latest') as ServiceNode;
    expect(test_node.node_config.getEnvironmentVariables()).to.deep.eq({
      SMTP_ADDR: 'smtp://test-user:test-pass@architect--smtp--maildev--latest--v6zeftja:1025',
      SMTP_USER: 'test-user',
      SMTP_PASS: 'test-pass',
    });
  });

  it('should allow HTTP basic auth values to be parameters', async () => {
    const smtp_config = `
      name: architect/smtp
      parameters:
        SMTP_USER: param-user
        SMTP_PASS: param-pass
      services:
        maildev:
          image: maildev/maildev
          interfaces:
            smtp:
              port: 1025
              protocol: smtp
              username: \${{ parameters.SMTP_USER }}
              password: \${{ parameters.SMTP_PASS }}
            dashboard: 1080
        test-app:
          image: hashicorp/http-echo
          environment:
            SMTP_ADDR: \${{ services.maildev.interfaces.smtp.url }}
            SMTP_USER: \${{ services.maildev.interfaces.smtp.username }}
            SMTP_PASS: \${{ services.maildev.interfaces.smtp.password }}
    `;

    mock_fs({
      '/stack/smtp/architect.yml': smtp_config,
    });

    const manager = new LocalDependencyManager(axios.create());
    const graph = await manager.getGraph([]); // TODO:207

    const test_node = graph.getNodeByRef('architect/smtp/test-app:latest') as ServiceNode;
    expect(test_node.node_config.getEnvironmentVariables()).to.deep.eq({
      SMTP_ADDR: 'smtp://param-user:param-pass@architect--smtp--maildev--latest--v6zeftja:1025',
      SMTP_USER: 'param-user',
      SMTP_PASS: 'param-pass',
    });
  });

  it('should support HTTP basic auth for dependency interfaces', async () => {
    const smtp_config = `
      name: architect/smtp
      services:
        maildev:
          image: maildev/maildev
          interfaces:
            smtp:
              port: 1025
              protocol: smtp
              username: test-user
              password: test-pass
            dashboard: 1080
      interfaces:
        smtp: \${{ services.maildev.interfaces.smtp.url }}
    `;

    const upstream_config = `
      name: architect/upstream
      dependencies:
        architect/smtp: latest
      services:
        test-app:
          image: hashicorp/http-echo
          environment:
            SMTP_ADDR: \${{ dependencies['architect/smtp'].interfaces.smtp.url }}
            SMTP_USER: \${{ dependencies['architect/smtp'].interfaces.smtp.username }}
            SMTP_PASS: \${{ dependencies['architect/smtp'].interfaces.smtp.password }}
    `;

    mock_fs({
      '/stack/smtp/architect.yml': smtp_config,
      '/stack/upstream/architect.yml': upstream_config,
    });

    const manager = new LocalDependencyManager(axios.create());
    const graph = await manager.getGraph([]); // TODO:207

    const test_node = graph.getNodeByRef('architect/upstream/test-app:latest') as ServiceNode;
    expect(test_node.node_config.getEnvironmentVariables()).to.deep.eq({
      SMTP_ADDR: 'smtp://test-user:test-pass@architect--smtp--maildev--latest--v6zeftja:1025',
      SMTP_USER: 'test-user',
      SMTP_PASS: 'test-pass',
    });
  });
});
