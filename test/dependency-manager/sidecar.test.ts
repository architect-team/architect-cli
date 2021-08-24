import { expect } from '@oclif/test';
import axios from 'axios';
import { deserialize, serialize } from 'class-transformer';
import yaml from 'js-yaml';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import path from 'path';
import sinon from 'sinon';
import Register from '../../src/commands/register';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../../src/common/docker-compose';
import { DockerService } from '../../src/common/docker-compose/template';
import PortUtil from '../../src/common/utils/port';
import { buildInterfacesRef, DependencyNode, resourceRefToNodeRef, ServiceNode } from '../../src/dependency-manager/src';
import DependencyGraph from '../../src/dependency-manager/src/graph';
import IngressEdge from '../../src/dependency-manager/src/graph/edge/ingress';

describe('sidecar spec v1', () => {
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

  describe('sidecar leaf-branch', () => {
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
            depends_on: ['db'],
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

    const branch_ref = resourceRefToNodeRef('test/branch/api:latest');
    const leaf_interfaces_ref = resourceRefToNodeRef('test/leaf:latest');
    const leaf_db_ref = resourceRefToNodeRef('test/leaf/db:latest');
    const leaf_api_ref = resourceRefToNodeRef('test/leaf/api:latest');

    it('sidecar should connect two services together', async () => {
      mock_fs({
        '/stack/leaf/architect.yml': yaml.dump(leaf_component),
      });

      const manager = new LocalDependencyManager(axios.create(), {
        'test/leaf': '/stack/leaf/architect.yml'
      });
      manager.use_sidecar = true;
      const graph = await manager.getGraph([
        await manager.loadComponentConfig('test/leaf')
      ]);

      expect(graph.nodes.map((n) => n.ref)).has.members([
        leaf_db_ref,
        leaf_api_ref
      ])
      expect(graph.edges.map((e) => e.toString())).has.members([
        `${leaf_api_ref} [service->postgres] -> ${leaf_db_ref} [postgres]`,
      ])
      const api_node = graph.getNodeByRef(leaf_api_ref) as ServiceNode;
      expect(Object.entries(api_node.config.environment).map(([k, v]) => `${k}=${v}`)).has.members([
        'DB_PROTOCOL=postgres',
        `DB_HOST=127.0.0.1`,
        'DB_PORT=12345',
        `DB_URL=postgres://127.0.0.1:12345`
      ])
    });

    it('sidecar should connect services to dependency interfaces', async () => {
      leaf_component.interfaces = {
        api: {
          url: '${{ services.api.interfaces.main.url }}',
        }
      };

      mock_fs({
        '/stack/leaf/architect.yml': yaml.dump(leaf_component),
        '/stack/branch/architect.yml': yaml.dump(branch_component),
      });

      const manager = new LocalDependencyManager(axios.create(), {
        'test/leaf': '/stack/leaf/architect.yml',
        'test/branch': '/stack/branch/architect.yml'
      });
      manager.use_sidecar = true;
      const graph = await manager.getGraph([
        await manager.loadComponentConfig('test/leaf'),
        await manager.loadComponentConfig('test/branch')
      ]);

      expect(graph.nodes.map((n) => n.ref)).has.members([
        branch_ref,
        leaf_db_ref,
        leaf_api_ref,
        leaf_interfaces_ref
      ])
      expect(graph.edges.map((e) => e.toString())).has.members([
        `${leaf_api_ref} [service->postgres] -> ${leaf_db_ref} [postgres]`,
        `${leaf_interfaces_ref} [api] -> ${leaf_api_ref} [main]`,

        `${branch_ref} [service->api] -> ${leaf_interfaces_ref} [api]`,
      ])
      const branch_api_node = graph.getNodeByRef(branch_ref) as ServiceNode;

      expect(Object.entries(branch_api_node.config.environment).map(([k, v]) => `${k}=${v}`)).has.members([
        'LEAF_PROTOCOL=http',
        `LEAF_HOST=127.0.0.1`,
        'LEAF_PORT=12345',
        `LEAF_URL=http://127.0.0.1:12345`
      ])
    });

    it('sidecar should expose environment interfaces via a gateway', async () => {
      leaf_component.interfaces = {
        api: '${{ services.api.interfaces.main.url }}',
      };
      branch_component.services.api.environment.EXTERNAL_INTERFACE = "${{ dependencies['test/leaf'].ingresses['api'].url }}";
      branch_component.services.api.environment.EXTERNAL_INTERFACE2 = "${{ environment.ingresses['test/leaf']['api'].url }}";

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
            depends_on: ['db'],
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

      mock_fs({
        '/stack/leaf/architect.yml': yaml.dump(leaf_component),
        '/stack/branch/architect.yml': yaml.dump(branch_component),
        '/stack/other-leaf/architect.yml': yaml.dump(other_leaf_component),
      });

      const manager = new LocalDependencyManager(axios.create(), {
        'test/leaf': '/stack/leaf/architect.yml',
        'test/branch': '/stack/branch/architect.yml',
        'test/other-leaf': '/stack/other-leaf/architect.yml'
      });
      manager.use_sidecar = true;
      const graph = await manager.getGraph([
        await manager.loadComponentConfig('test/leaf', { public: 'api' }),
        await manager.loadComponentConfig('test/branch'),
        await manager.loadComponentConfig('test/other-leaf', { publicv1: 'api' })
      ]);

      const other_leaf_interfaces_ref = resourceRefToNodeRef('test/other-leaf:latest');
      const other_leaf_api_ref = resourceRefToNodeRef('test/other-leaf/api:latest');
      const other_leaf_db_ref = resourceRefToNodeRef('test/other-leaf/db:latest');

      expect(graph.nodes.map((n) => n.ref)).has.members([
        'gateway',

        branch_ref,

        leaf_interfaces_ref,
        leaf_api_ref,
        leaf_db_ref,

        other_leaf_interfaces_ref,
        other_leaf_api_ref,
        other_leaf_db_ref,
      ])
      expect(graph.edges.map((e) => e.toString())).has.members([
        `gateway [public] -> ${leaf_interfaces_ref} [api]`,
        `gateway [publicv1] -> ${other_leaf_interfaces_ref} [api]`,

        `${leaf_api_ref} [service->postgres] -> ${leaf_db_ref} [postgres]`,
        `${leaf_interfaces_ref} [api] -> ${leaf_api_ref} [main]`,

        `${other_leaf_api_ref} [service->postgres] -> ${other_leaf_db_ref} [postgres]`,
        `${other_leaf_interfaces_ref} [api] -> ${other_leaf_api_ref} [main]`,

        `${branch_ref} [service->api] -> ${leaf_interfaces_ref} [api]`,
      ])
      const branch_api_node = graph.getNodeByRef(branch_ref) as ServiceNode;
      expect(Object.entries(branch_api_node.config.environment).map(([k, v]) => `${k}=${v}`)).has.members([
        'LEAF_PROTOCOL=http',
        `LEAF_HOST=127.0.0.1`,
        'LEAF_PORT=12345',
        `LEAF_URL=http://127.0.0.1:12345`,
        'EXTERNAL_INTERFACE=http://public.arc.localhost',
        'EXTERNAL_INTERFACE2=http://public.arc.localhost',
      ])

      const template = await DockerComposeUtils.generate(graph);
      expect(Object.keys(template.services)).has.members([
        branch_ref,
        leaf_db_ref,
        leaf_api_ref,
        other_leaf_db_ref,
        other_leaf_api_ref,
        'gateway'
      ]);

      const expected_leaf_compose: DockerService = {
        depends_on: [leaf_api_ref],
        environment: {
          LEAF_HOST: '127.0.0.1',
          LEAF_PORT: '12345',
          LEAF_PROTOCOL: 'http',
          LEAF_URL: `http://127.0.0.1:12345`,
          EXTERNAL_INTERFACE: 'http://public.arc.localhost',
          EXTERNAL_INTERFACE2: 'http://public.arc.localhost'
        },
        image: 'branch:latest',
        external_links: [
          'gateway:public.arc.localhost',
          'gateway:publicv1.arc.localhost'
        ]
      };
      expect(template.services[branch_ref]).to.be.deep.equal(expected_leaf_compose);

      const expected_leaf_db_compose: DockerService = {
        environment: {},
        image: 'postgres:11',
        ports: ['50000:5432'],
        external_links: [
          'gateway:public.arc.localhost',
          'gateway:publicv1.arc.localhost'
        ],
      };
      expect(template.services[leaf_db_ref]).to.be.deep.equal(expected_leaf_db_compose);

      const expected_leaf_api_compose: DockerService = {
        depends_on: [leaf_db_ref],
        environment: {
          DB_HOST: '127.0.0.1',
          DB_PORT: '12345',
          DB_PROTOCOL: 'postgres',
          DB_URL: `postgres://127.0.0.1:12345`
        },
        "labels": [
          "traefik.enable=true",
          "traefik.port=80",
          "traefik.http.routers.public.rule=Host(`public.arc.localhost`)",
          "traefik.http.routers.public.service=public-service",
          "traefik.http.routers.public.entrypoints=web",
          "traefik.http.routers.public-https.rule=Host(`public.arc.localhost`)",
          "traefik.http.routers.public-https.service=public-service",
          "traefik.http.routers.public-https.entrypoints=websecure",
          "traefik.http.routers.public-https.tls=true",
          "traefik.http.services.public-service.loadbalancer.server.port=8080",
          "traefik.http.services.public-service.loadbalancer.server.scheme=http"
        ],
        image: 'api:latest',
        ports: ['50001:8080'],
        external_links: [
          'gateway:public.arc.localhost',
          'gateway:publicv1.arc.localhost'
        ],
      };
      expect(template.services[leaf_api_ref]).to.be.deep.equal(expected_leaf_api_compose);

      const expected_other_leaf_db_compose: DockerService = {
        environment: {},
        image: 'postgres:11',
        ports: ['50002:5432'],
        external_links: [
          'gateway:public.arc.localhost',
          'gateway:publicv1.arc.localhost'
        ],
      };
      expect(template.services[other_leaf_db_ref]).to.be.deep.equal(expected_other_leaf_db_compose);

      const expected_other_leaf_api_compose: DockerService = {
        depends_on: [other_leaf_db_ref],
        environment: {
          DB_HOST: '127.0.0.1',
          DB_PORT: '12345',
          DB_PROTOCOL: 'postgres',
          DB_URL: `postgres://127.0.0.1:12345`
        },
        "labels": [
          "traefik.enable=true",
          "traefik.port=80",
          "traefik.http.routers.publicv1.rule=Host(`publicv1.arc.localhost`)",
          "traefik.http.routers.publicv1.service=publicv1-service",
          "traefik.http.routers.publicv1.entrypoints=web",
          "traefik.http.routers.publicv1-https.rule=Host(`publicv1.arc.localhost`)",
          "traefik.http.routers.publicv1-https.service=publicv1-service",
          "traefik.http.routers.publicv1-https.entrypoints=websecure",
          "traefik.http.routers.publicv1-https.tls=true",
          "traefik.http.services.publicv1-service.loadbalancer.server.port=8080",
          "traefik.http.services.publicv1-service.loadbalancer.server.scheme=http"
        ],
        image: 'api:latest',
        ports: ['50003:8080'],
        external_links: [
          'gateway:public.arc.localhost',
          'gateway:publicv1.arc.localhost'
        ],
      };
      expect(template.services[other_leaf_api_ref]).to.be.deep.equal(expected_other_leaf_api_compose);
    });
  });

  it('sidecar service with multiple public interfaces', async () => {
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
      '/stack/architect.yml': yaml.dump(component_config),
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'architect/cloud': '/stack/architect.yml',
    });
    manager.use_sidecar = true;
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('architect/cloud', { app: 'app', admin: 'admin' }),
    ]);

    const cloud_interfaces_ref = resourceRefToNodeRef('architect/cloud:latest')
    const api_ref = resourceRefToNodeRef('architect/cloud/api:latest')

    expect(graph.nodes.map((n) => n.ref)).has.members([
      'gateway',
      cloud_interfaces_ref,
      api_ref,
    ])
    expect(graph.edges.map((e) => e.toString())).has.members([
      `${cloud_interfaces_ref} [app, admin] -> ${api_ref} [main, admin]`,
      `gateway [app, admin] -> ${cloud_interfaces_ref} [app, admin]`
    ])

    const template = await DockerComposeUtils.generate(graph);
    const expected_compose: DockerService = {
      "environment": {},
      "labels": [
        "traefik.enable=true",
        "traefik.port=80",
        "traefik.http.routers.app.rule=Host(`app.arc.localhost`)",
        "traefik.http.routers.app.service=app-service",
        "traefik.http.routers.app.entrypoints=web",
        "traefik.http.routers.app-https.rule=Host(`app.arc.localhost`)",
        "traefik.http.routers.app-https.service=app-service",
        "traefik.http.routers.app-https.entrypoints=websecure",
        "traefik.http.routers.app-https.tls=true",
        "traefik.http.services.app-service.loadbalancer.server.port=8080",
        "traefik.http.services.app-service.loadbalancer.server.scheme=http",
        "traefik.http.routers.admin.rule=Host(`admin.arc.localhost`)",
        "traefik.http.routers.admin.service=admin-service",
        "traefik.http.routers.admin.entrypoints=web",
        "traefik.http.routers.admin-https.rule=Host(`admin.arc.localhost`)",
        "traefik.http.routers.admin-https.service=admin-service",
        "traefik.http.routers.admin-https.entrypoints=websecure",
        "traefik.http.routers.admin-https.tls=true",
        "traefik.http.services.admin-service.loadbalancer.server.port=8081",
        "traefik.http.services.admin-service.loadbalancer.server.scheme=http"
      ],
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
    };
    expect(template.services[api_ref]).to.be.deep.equal(expected_compose);
  });

  it('sidecar using multiple ports from a dependency', async () => {
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
            EXTERNAL_API_ADDR: \${{ dependencies['voic/product-catalog'].ingresses['public'].url }}
            EXTERNAL_API_ADDR2: \${{ environment.ingresses['voic/product-catalog']['public'].url }}
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

    const manager = new LocalDependencyManager(axios.create(), {
      'voic/admin-ui': '/stack/admin-ui/architect.yml',
      'voic/product-catalog': '/stack/product-catalog/architect.yml'
    });
    manager.use_sidecar = true;

    const admin_component = await manager.loadComponentConfig('voic/admin-ui@tenant-1');
    const admin_instance_id = 'env1-tenant-1';
    admin_component.instance_metadata!.instance_id = admin_instance_id;

    const test_component = await manager.loadComponentConfig('voic/admin-ui@tenant-1');
    expect(buildInterfacesRef(admin_component)).to.not.equal(buildInterfacesRef(test_component));

    const test2_component = await manager.loadComponentConfig('voic/admin-ui@tenant-2');
    test2_component.instance_metadata!.instance_id = 'env1-tenant-1';
    expect(buildInterfacesRef(admin_component)).to.not.equal(buildInterfacesRef(test2_component));

    const test3_component = await manager.loadComponentConfig('voic/admin-ui@tenant-1');
    test3_component.instance_metadata!.instance_id = 'env1-tenant-1-test';
    expect(buildInterfacesRef(admin_component)).to.not.equal(buildInterfacesRef(test3_component));

    const catalog_component = await manager.loadComponentConfig('voic/product-catalog', { public2: 'public', admin2: 'admin' })
    const catalog_instance_id = 'env1'
    catalog_component.instance_metadata!.instance_id = catalog_instance_id;

    const graph = await manager.getGraph([
      admin_component,
      catalog_component,
    ]);

    const admin_ref = resourceRefToNodeRef('voic/admin-ui/dashboard:latest@tenant-1', admin_instance_id)
    const catalog_interface_ref = resourceRefToNodeRef('voic/product-catalog:latest', catalog_instance_id)
    const api_ref = resourceRefToNodeRef('voic/product-catalog/api:latest', catalog_instance_id)

    expect(graph.edges.map(e => e.toString())).members([
      `${catalog_interface_ref} [public, admin, private] -> ${api_ref} [public, admin, private]`,
      `${admin_ref} [service->public, service->admin, service->private] -> ${catalog_interface_ref} [public, admin, private]`,
      `gateway [public2, admin2] -> ${catalog_interface_ref} [public, admin]`,
    ])

    const ingress_edges = graph.edges.filter((edge) => edge instanceof IngressEdge);

    const ingress_edge = ingress_edges[0];
    const [node_to, node_to_interface_name] = graph.followEdge(ingress_edge, 'public2');
    expect(node_to).instanceOf(ServiceNode);
    expect(node_to_interface_name).to.eq('public');

    const [node_to2, node_to_interface_name2] = graph.followEdge(ingress_edge, 'admin2');
    expect(node_to2).instanceOf(ServiceNode);
    expect(node_to_interface_name2).to.eq('admin');

    const dashboard_node = graph.getNodeByRef(admin_ref) as ServiceNode;
    expect(dashboard_node.config.environment).to.deep.eq({
      ADMIN_ADDR: `http://127.0.0.1:12346`,
      API_ADDR: `http://127.0.0.1:12345`,
      PRIVATE_ADDR: `http://127.0.0.1:12347`,
      EXTERNAL_API_ADDR: 'http://public2.arc.localhost',
      EXTERNAL_API_ADDR2: 'http://public2.arc.localhost',
    });
  });

  it('sidecar should support HTTP basic auth', async () => {
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

    const manager = new LocalDependencyManager(axios.create(), {
      'architect/smtp': '/stack/smtp/architect.yml',
    });
    manager.use_sidecar = true;
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('architect/smtp'),
    ]);

    const app_ref = resourceRefToNodeRef('architect/smtp/test-app:latest');

    const test_node = graph.getNodeByRef(app_ref) as ServiceNode;
    expect(test_node.config.environment).to.deep.eq({
      SMTP_ADDR: `smtp://test-user:test-pass@127.0.0.1:12345`,
      SMTP_USER: 'test-user',
      SMTP_PASS: 'test-pass',
    });
  });

  it('sidecar should support HTTP basic auth for dependency interfaces', async () => {
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

    const manager = new LocalDependencyManager(axios.create(), {
      'architect/smtp': '/stack/smtp/architect.yml',
      'architect/upstream': '/stack/upstream/architect.yml',
    });
    manager.use_sidecar = true;
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('architect/smtp'),
      await manager.loadComponentConfig('architect/upstream'),
    ]);

    const raw = serialize(graph);
    const new_graph = deserialize(DependencyGraph, raw)
    expect(new_graph).instanceOf(DependencyGraph);
    expect(new_graph.nodes[0]).instanceOf(DependencyNode);

    const app_ref = resourceRefToNodeRef('architect/upstream/test-app:latest');

    const test_node = graph.getNodeByRef(app_ref) as ServiceNode;
    expect(test_node.config.environment).to.deep.eq({
      SMTP_ADDR: `smtp://test-user:test-pass@127.0.0.1:12345`,
      SMTP_USER: 'test-user',
      SMTP_PASS: 'test-pass',
    });
  });
});
