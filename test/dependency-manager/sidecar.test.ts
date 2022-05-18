import { expect } from '@oclif/test';
import axios from 'axios';
import { deserialize, serialize } from 'class-transformer';
import yaml from 'js-yaml';
import mock_fs from 'mock-fs';
import path from 'path';
import { DependencyGraph, DependencyNode, ecsResourceRefToNodeRef, ServiceNode } from '../../src';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../../src/common/docker-compose';
import { DockerService } from '../../src/common/docker-compose/template';

describe('sidecar spec v1', () => {

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

    const branch_ref = ecsResourceRefToNodeRef('test/branch.services.api');
    const leaf_interfaces_ref = ecsResourceRefToNodeRef('test/leaf');
    const leaf_db_ref = ecsResourceRefToNodeRef('test/leaf.services.db');
    const left_api_resource_ref = 'test/leaf.services.api';
    const leaf_api_ref = ecsResourceRefToNodeRef(left_api_resource_ref);

    it('sidecar should connect two services together', async () => {
      mock_fs({
        '/stack/leaf/architect.yml': yaml.dump(leaf_component),
      });

      const manager = new LocalDependencyManager(axios.create(), {
        'test/leaf': '/stack/leaf/architect.yml'
      });
      manager.use_sidecar = true;
      const graph = await manager.getGraph([
        await manager.loadComponentSpec('test/leaf')
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
        await manager.loadComponentSpec('test/leaf'),
        await manager.loadComponentSpec('test/branch')
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
        await manager.loadComponentSpec('test/leaf', { interfaces: { public: 'api' } }),
        await manager.loadComponentSpec('test/branch'),
        await manager.loadComponentSpec('test/other-leaf', { interfaces: { publicv1: 'api' } })
      ]);

      const other_leaf_interfaces_ref = ecsResourceRefToNodeRef('test/other-leaf');
      const other_leaf_api_resource_ref = 'test/other-leaf.services.api';
      const other_leaf_api_ref = ecsResourceRefToNodeRef(other_leaf_api_resource_ref);
      const other_leaf_db_ref = ecsResourceRefToNodeRef('test/other-leaf.services.db');

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
        ],
        labels: ['architect.ref=test/branch.services.api']
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
        labels: ['architect.ref=test/leaf.services.db']
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
          `architect.ref=test/leaf.services.api`,
          "traefik.enable=true",
          "traefik.port=80",
          `traefik.http.routers.${leaf_api_ref}-api.rule=Host(\`public.arc.localhost\`)`,
          `traefik.http.routers.${leaf_api_ref}-api.service=${leaf_api_ref}-api-service`,
          `traefik.http.services.${leaf_api_ref}-api-service.loadbalancer.server.port=8080`,
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
        labels: ['architect.ref=test/other-leaf.services.db']
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
          `architect.ref=test/other-leaf.services.api`,
          "traefik.enable=true",
          "traefik.port=80",
          `traefik.http.routers.${other_leaf_api_ref}-api.rule=Host(\`publicv1.arc.localhost\`)`,
          `traefik.http.routers.${other_leaf_api_ref}-api.service=${other_leaf_api_ref}-api-service`,
          `traefik.http.services.${other_leaf_api_ref}-api-service.loadbalancer.server.port=8080`,
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
      await manager.loadComponentSpec('architect/cloud', { interfaces: { app: 'app', admin: 'admin' } }),
    ]);

    const cloud_interfaces_ref = ecsResourceRefToNodeRef('architect/cloud')
    const api_resource_ref = 'architect/cloud.services.api';
    const api_ref = ecsResourceRefToNodeRef(api_resource_ref)

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
        `architect.ref=${api_resource_ref}`,
        "traefik.enable=true",
        "traefik.port=80",
        `traefik.http.routers.${api_ref}-app.rule=Host(\`app.arc.localhost\`)`,
        `traefik.http.routers.${api_ref}-app.service=${api_ref}-app-service`,
        `traefik.http.services.${api_ref}-app-service.loadbalancer.server.port=8080`,
        `traefik.http.routers.${api_ref}-admin.rule=Host(\`admin.arc.localhost\`)`,
        `traefik.http.routers.${api_ref}-admin.service=${api_ref}-admin-service`,
        `traefik.http.services.${api_ref}-admin-service.loadbalancer.server.port=8081`,
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

    const admin_instance_id = 'env1-tenant-1';
    const admin_component = await manager.loadComponentSpec('voic/admin-ui@tenant-1', { instance_id: admin_instance_id });

    const catalog_instance_id = 'env1'
    const catalog_component = await manager.loadComponentSpec('voic/product-catalog', { instance_id: catalog_instance_id, interfaces: { public2: 'public', admin2: 'admin' } })

    const graph = await manager.getGraph([
      admin_component,
      catalog_component,
    ]);

    const admin_ref = ecsResourceRefToNodeRef('voic/admin-ui.services.dashboard@tenant-1', admin_instance_id)
    const catalog_interface_ref = ecsResourceRefToNodeRef('voic/product-catalog', catalog_instance_id)
    const api_ref = ecsResourceRefToNodeRef('voic/product-catalog.services.api', catalog_instance_id)

    expect(graph.edges.map(e => e.toString())).members([
      `${catalog_interface_ref} [public, admin, private] -> ${api_ref} [public, admin, private]`,
      `${admin_ref} [service->public, service->admin, service->private] -> ${catalog_interface_ref} [public, admin, private]`,
      `gateway [public2, admin2] -> ${catalog_interface_ref} [public, admin]`,
    ])
    const dashboard_node = graph.getNodeByRef(admin_ref) as ServiceNode;
    expect(dashboard_node.config.environment).to.deep.eq({
      ADMIN_ADDR: `http://127.0.0.1:12347`,
      API_ADDR: `http://127.0.0.1:12346`,
      PRIVATE_ADDR: `http://127.0.0.1:12348`,
      EXTERNAL_API_ADDR: 'http://public2.arc.localhost',
      EXTERNAL_API_ADDR2: 'http://public2.arc.localhost',
    });
  });

  it('sidecar proxy_port_mapping with getGraph.validate=false', async () => {
    const stateless_config = `
      name: examples/stateless-component

      dependencies:
        examples/hello-world: latest

      services:
        stateless-app:
          build:
            context: ./
          interfaces:
            http: 8080
          environment:
            HELLO_WORLD_ADDR: \${{ dependencies['examples/hello-world'].interfaces.hello.url }}

      interfaces:
        frontend:
          description: Exposes the app to upstream traffic
          url: \${{ services.stateless-app.interfaces.http.url }}
      `;

    const hello_config = `
      name: examples/hello-world
      services:
        api:
          image: heroku/nodejs-hello-world
          interfaces:
            main: 3000

      interfaces:
        hello:
          description: Connects to the hello-world service to return "Hello World!" on-demand
          url: \${{ services.api.interfaces.main.url }}
    `;

    mock_fs({
      '/stack/stateless/architect.yml': stateless_config,
      '/stack/hello/architect.yml': hello_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/stateless-component': '/stack/stateless/architect.yml',
      'examples/hello-world': '/stack/hello/architect.yml'
    });
    manager.use_sidecar = true;

    const stateless_component = await manager.loadComponentSpec('examples/stateless-component:latest')
    const hello_component = await manager.loadComponentSpec('examples/hello-world:latest')

    const graph = await manager.getGraph([
      stateless_component,
      hello_component
    ], undefined, { interpolate: true, validate: false });

    const app_ref = ecsResourceRefToNodeRef('examples/stateless-component.services.stateless-app');
    const app_node = graph.getNodeByRef(app_ref);

    const ports = [];
    const edges = graph.edges.filter((edge) => edge.from === app_ref);
    for (const edge of edges) {
      const followed_edge_interface_mappings = graph.followEdge(edge);
      for (const interface_mapping of followed_edge_interface_mappings) {
        const port = app_node.proxy_port_mapping![`${edge.to}--${interface_mapping.interface_to}`];
        ports.push(port);
      }
    }

    expect(ports).to.deep.equal([12346])
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
      await manager.loadComponentSpec('architect/smtp'),
    ]);

    const app_ref = ecsResourceRefToNodeRef('architect/smtp.services.test-app');

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
      await manager.loadComponentSpec('architect/smtp'),
      await manager.loadComponentSpec('architect/upstream'),
    ]);

    const raw = serialize(graph);
    const new_graph = deserialize(DependencyGraph, raw)
    expect(new_graph).instanceOf(DependencyGraph);
    expect(new_graph.nodes[0]).instanceOf(DependencyNode);

    const app_ref = ecsResourceRefToNodeRef('architect/upstream.services.test-app');

    const test_node = graph.getNodeByRef(app_ref) as ServiceNode;
    expect(test_node.config.environment).to.deep.eq({
      SMTP_ADDR: `smtp://test-user:test-pass@127.0.0.1:12345`,
      SMTP_USER: 'test-user',
      SMTP_PASS: 'test-pass',
    });
  });
});
