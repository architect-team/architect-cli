import { expect } from '@oclif/test';
import axios from 'axios';
import yaml from 'js-yaml';
import mock_fs from 'mock-fs';
import path from 'path';
import { ArchitectError, resourceRefToNodeRef, ServiceNode, ValidationErrors } from '../../src';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../../src/common/docker-compose';
import { DockerService } from '../../src/common/docker-compose/template';

describe('interfaces spec v1', () => {

  describe('leaf-branch', () => {
    let leaf_component = {} as any,
      branch_component = {} as any;

    beforeEach(async () => {
      leaf_component = {
        name: 'leaf',
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
              main: 8080,
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
        interfaces: {},
      };

      branch_component = {
        name: 'branch',
        dependencies: {
          'leaf': 'latest',
        },
        services: {
          api: {
            image: 'branch:latest',
            interfaces: {},
            environment: {
              LEAF_PROTOCOL: '${{ dependencies.leaf.interfaces.api.protocol }}',
              LEAF_HOST: '${{ dependencies.leaf.interfaces.api.host }}',
              LEAF_PORT: '${{ dependencies.leaf.interfaces.api.port }}',
              LEAF_URL: '${{ dependencies.leaf.interfaces.api.url }}',
            },
          },
        },
        interfaces: {},
      };
    });

    const branch_ref = resourceRefToNodeRef('branch.services.api');
    const leaf_db_ref = resourceRefToNodeRef('leaf.services.db');
    const leaf_api_resource_ref = 'leaf.services.api';
    const leaf_api_ref = resourceRefToNodeRef(leaf_api_resource_ref);

    it('should connect two services together', async () => {
      mock_fs({
        '/stack/leaf/architect.yml': yaml.dump(leaf_component),
      });

      const manager = new LocalDependencyManager(axios.create(), 'architect', {
        'leaf': '/stack/leaf/architect.yml',
      });
      const graph = await manager.getGraph([
        await manager.loadComponentSpec('leaf'),
      ]);

      expect(graph.nodes.map((n) => n.ref)).has.members([
        leaf_db_ref,
        leaf_api_ref,
      ]);
      expect(graph.edges.map((e) => e.toString())).has.members([
        `${leaf_api_ref} -> ${leaf_db_ref}[postgres]`,
      ]);
      const api_node = graph.getNodeByRef(leaf_api_ref) as ServiceNode;
      expect(Object.entries(api_node.config.environment).map(([k, v]) => `${k}=${v}`)).has.members([
        'DB_PROTOCOL=postgres',
        `DB_HOST=${leaf_db_ref}`,
        'DB_PORT=5432',
        `DB_URL=postgres://${leaf_db_ref}:5432`,
      ]);
    });

    it('should connect services to dependency interfaces', async () => {
      leaf_component.interfaces = {
        api: {
          url: '${{ services.api.interfaces.main.url }}',
        },
      };

      mock_fs({
        '/stack/leaf/architect.yml': yaml.dump(leaf_component),
        '/stack/branch/architect.yml': yaml.dump(branch_component),
      });

      const manager = new LocalDependencyManager(axios.create(), 'architect', {
        'leaf': '/stack/leaf/architect.yml',
        'branch': '/stack/branch/architect.yml',
      });
      const graph = await manager.getGraph([
        await manager.loadComponentSpec('leaf'),
        await manager.loadComponentSpec('branch'),
      ]);

      expect(graph.nodes.map((n) => n.ref)).has.members([
        branch_ref,
        leaf_db_ref,
        leaf_api_ref,
      ]);
      expect(graph.edges.map((e) => e.toString())).has.members([
        `${leaf_api_ref} -> ${leaf_db_ref}[postgres]`,
        `${branch_ref} -> ${leaf_api_ref}[api]`,
      ]);
      const branch_api_node = graph.getNodeByRef(branch_ref) as ServiceNode;

      expect(Object.entries(branch_api_node.config.environment).map(([k, v]) => `${k}=${v}`)).has.members([
        'LEAF_PROTOCOL=http',
        `LEAF_HOST=${leaf_api_ref}`,
        'LEAF_PORT=8080',
        `LEAF_URL=http://${leaf_api_ref}:8080`,
      ]);
    });

    it('should expose environment interfaces via a gateway', async () => {
      leaf_component.interfaces = {
        api: '${{ services.api.interfaces.main.url }}',
      };
      branch_component.services.api.environment.EXTERNAL_INTERFACE = "${{ dependencies['leaf'].ingresses['api'].url }}";
      branch_component.services.api.environment.EXTERNAL_INTERFACE2 = "${{ environment.ingresses['leaf']['api'].url }}";

      const other_leaf_component = {
        name: 'other-leaf',
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
            depends_on: ['db'],
            interfaces: {
              main: 8080,
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
        },
      };

      mock_fs({
        '/stack/leaf/architect.yml': yaml.dump(leaf_component),
        '/stack/branch/architect.yml': yaml.dump(branch_component),
        '/stack/other-leaf/architect.yml': yaml.dump(other_leaf_component),
      });

      const manager = new LocalDependencyManager(axios.create(), 'architect', {
        'leaf': '/stack/leaf/architect.yml',
        'branch': '/stack/branch/architect.yml',
        'other-leaf': '/stack/other-leaf/architect.yml',
      });
      const graph = await manager.getGraph([
        await manager.loadComponentSpec('leaf', { interfaces: { public: 'api' } }),
        await manager.loadComponentSpec('branch'),
        await manager.loadComponentSpec('other-leaf', { interfaces: { publicv1: 'api' } }),
      ]);

      const other_leaf_api_ref = resourceRefToNodeRef('other-leaf.services.api');
      const other_leaf_db_ref = resourceRefToNodeRef('other-leaf.services.db');

      expect(graph.nodes.map((n) => n.ref)).has.members([
        'gateway',

        branch_ref,

        leaf_api_ref,
        leaf_db_ref,

        other_leaf_api_ref,
        other_leaf_db_ref,
      ]);
      expect(graph.edges.map((e) => e.toString())).has.members([
        `gateway -> ${leaf_api_ref}[api]`,
        `gateway -> ${other_leaf_api_ref}[api]`,

        `${leaf_api_ref} -> ${leaf_db_ref}[postgres]`,

        `${other_leaf_api_ref} -> ${other_leaf_db_ref}[postgres]`,

        `${branch_ref} -> ${leaf_api_ref}[api]`,
      ]);
      const branch_api_node = graph.getNodeByRef(branch_ref) as ServiceNode;
      expect(Object.entries(branch_api_node.config.environment).map(([k, v]) => `${k}=${v}`)).has.members([
        'LEAF_PROTOCOL=http',
        `LEAF_HOST=${leaf_api_ref}`,
        'LEAF_PORT=8080',
        `LEAF_URL=http://${leaf_api_ref}:8080`,
        'EXTERNAL_INTERFACE=http://public.arc.localhost',
        'EXTERNAL_INTERFACE2=http://public.arc.localhost',
      ]);

      const template = await DockerComposeUtils.generate(graph);
      expect(Object.keys(template.services)).has.members([
        branch_ref,
        leaf_db_ref,
        leaf_api_ref,
        other_leaf_db_ref,
        other_leaf_api_ref,
        'gateway',
      ]);

      const expected_leaf_compose: DockerService = {
        depends_on: [leaf_api_ref],
        environment: {
          LEAF_HOST: leaf_api_ref,
          LEAF_PORT: '8080',
          LEAF_PROTOCOL: 'http',
          LEAF_URL: `http://${leaf_api_ref}:8080`,
          EXTERNAL_INTERFACE: 'http://public.arc.localhost',
          EXTERNAL_INTERFACE2: 'http://public.arc.localhost',
        },
        image: 'branch:latest',
        external_links: [
          'gateway:public.arc.localhost',
          'gateway:publicv1.arc.localhost',
        ],
        labels: ['architect.ref=branch.services.api'],
      };
      expect(template.services[branch_ref]).to.be.deep.equal(expected_leaf_compose);

      const expected_leaf_db_compose: DockerService = {
        environment: {},
        image: 'postgres:11',
        ports: ['50000:5432'],
        external_links: [
          'gateway:public.arc.localhost',
          'gateway:publicv1.arc.localhost',
        ],
        labels: ['architect.ref=leaf.services.db'],
      };
      expect(template.services[leaf_db_ref]).to.be.deep.equal(expected_leaf_db_compose);

      const expected_leaf_api_compose: DockerService = {
        depends_on: [leaf_db_ref],
        environment: {
          DB_HOST: leaf_db_ref,
          DB_PORT: '5432',
          DB_PROTOCOL: 'postgres',
          DB_URL: `postgres://${leaf_db_ref}:5432`,
        },
        "labels": [
          `architect.ref=${leaf_api_resource_ref}`,
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
          'gateway:publicv1.arc.localhost',
        ],
      };
      expect(template.services[leaf_api_ref]).to.be.deep.equal(expected_leaf_api_compose);

      const expected_other_leaf_db_compose: DockerService = {
        environment: {},
        image: 'postgres:11',
        ports: ['50002:5432'],
        external_links: [
          'gateway:public.arc.localhost',
          'gateway:publicv1.arc.localhost',
        ],
        labels: ['architect.ref=other-leaf.services.db'],
      };
      expect(template.services[other_leaf_db_ref]).to.be.deep.equal(expected_other_leaf_db_compose);

      const expected_other_leaf_api_compose: DockerService = {
        depends_on: [other_leaf_db_ref],
        environment: {
          DB_HOST: other_leaf_db_ref,
          DB_PORT: '5432',
          DB_PROTOCOL: 'postgres',
          DB_URL: `postgres://${other_leaf_db_ref}:5432`,
        },
        "labels": [
          `architect.ref=other-leaf.services.api`,
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
          'gateway:publicv1.arc.localhost',
        ],
      };
      expect(template.services[other_leaf_api_ref]).to.be.deep.equal(expected_other_leaf_api_compose);
    });
  });

  it('service with multiple public interfaces', async () => {
    const component_config = {
      name: 'cloud',
      services: {
        api: {
          interfaces: {
            app: 8080,
            admin: 8081,
          },
        },
      },
      interfaces: {
        app: '${{ services.api.interfaces.app.url }}',
        admin: '${{ services.api.interfaces.admin.url }}',
      },
    };

    mock_fs({
      '/stack/architect.yml': yaml.dump(component_config),
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'cloud': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('cloud', { interfaces: { app: 'app', admin: 'admin' } }),
    ]);

    const api_resource_ref = 'cloud.services.api';
    const api_ref = resourceRefToNodeRef(api_resource_ref);

    expect(graph.nodes.map((n) => n.ref)).has.members([
      'gateway',
      api_ref,
    ]);
    expect(graph.edges.map((e) => e.toString())).has.members([
      `gateway -> ${api_ref}[app]`,
      `gateway -> ${api_ref}[admin]`,
    ]);

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
        "gateway:admin.arc.localhost",
      ],
      "ports": [
        "50000:8080",
        "50001:8081",
      ],
      "build": {
        "context": path.resolve("/stack"),
      },
      image: api_ref,
    };
    expect(template.services[api_ref]).to.be.deep.equal(expected_compose);
  });

  it('using multiple ports from a dependency', async () => {
    const admin_ui_config = `
      name: admin-ui
      dependencies:
        product-catalog: latest
      services:
        dashboard:
          interfaces:
            main: 3000
          environment:
            API_ADDR: \${{ dependencies['product-catalog'].interfaces.public.url }}
            ADMIN_ADDR: \${{ dependencies['product-catalog'].interfaces.admin.url }}
            PRIVATE_ADDR: \${{ dependencies['product-catalog'].interfaces.private.url }}
            EXTERNAL_API_ADDR: \${{ dependencies['product-catalog'].ingresses['public'].url }}
            EXTERNAL_API_ADDR2: \${{ environment.ingresses['product-catalog']['public'].url }}
      `;

    const product_catalog_config = `
      name: product-catalog
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

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'admin-ui': '/stack/admin-ui/architect.yml',
      'product-catalog': '/stack/product-catalog/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('admin-ui'),
      await manager.loadComponentSpec('product-catalog', { interfaces: { public2: 'public', admin2: 'admin' } }),
    ]);

    const admin_ref = resourceRefToNodeRef('admin-ui.services.dashboard');
    const api_ref = resourceRefToNodeRef('product-catalog.services.api');

    expect(graph.edges.map(e => e.toString())).members([
      `${admin_ref} -> ${api_ref}[public]`,
      `${admin_ref} -> ${api_ref}[admin]`,
      `${admin_ref} -> ${api_ref}[private]`,
      `gateway -> ${api_ref}[public]`,
      `gateway -> ${api_ref}[admin]`,
    ]);

    const dashboard_node = graph.getNodeByRef(admin_ref) as ServiceNode;
    expect(dashboard_node.config.environment).to.deep.eq({
      ADMIN_ADDR: `http://${api_ref}:8081`,
      API_ADDR: `http://${api_ref}:8080`,
      PRIVATE_ADDR: `http://${api_ref}:8082`,
      EXTERNAL_API_ADDR: 'http://public2.arc.localhost',
      EXTERNAL_API_ADDR2: 'http://public2.arc.localhost',
    });
  });

  it('should support HTTP basic auth', async () => {
    const smtp_config = `
      name: smtp
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

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'smtp': '/stack/smtp/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('smtp'),
    ]);

    const mail_ref = resourceRefToNodeRef('smtp.services.maildev');
    const app_ref = resourceRefToNodeRef('smtp.services.test-app');

    const test_node = graph.getNodeByRef(app_ref) as ServiceNode;
    expect(test_node.config.environment).to.deep.eq({
      SMTP_ADDR: `smtp://test-user:test-pass@${mail_ref}:1025`,
      SMTP_USER: 'test-user',
      SMTP_PASS: 'test-pass',
    });
  });

  it('should allow HTTP basic auth values to be secrets', async () => {
    const smtp_config = `
      name: smtp
      secrets:
        SMTP_USER: param-user
        SMTP_PASS: param-pass
      services:
        maildev:
          image: maildev/maildev
          interfaces:
            smtp:
              port: 1025
              protocol: smtp
              username: \${{ secrets.SMTP_USER }}
              password: \${{ secrets.SMTP_PASS }}
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

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'smtp': '/stack/smtp/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('smtp'),
    ]);

    const mail_ref = resourceRefToNodeRef('smtp.services.maildev');
    const app_ref = resourceRefToNodeRef('smtp.services.test-app');

    const test_node = graph.getNodeByRef(app_ref) as ServiceNode;
    expect(test_node.config.environment).to.deep.eq({
      SMTP_ADDR: `smtp://param-user:param-pass@${mail_ref}:1025`,
      SMTP_USER: 'param-user',
      SMTP_PASS: 'param-pass',
    });
  });

  it('should support HTTP basic auth for dependency interfaces', async () => {
    const smtp_config = `
      name: smtp
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
      name: upstream
      dependencies:
        smtp: latest
      services:
        test-app:
          image: hashicorp/http-echo
          environment:
            SMTP_ADDR: \${{ dependencies['smtp'].interfaces.smtp.url }}
            SMTP_USER: \${{ dependencies['smtp'].interfaces.smtp.username }}
            SMTP_PASS: \${{ dependencies['smtp'].interfaces.smtp.password }}
    `;

    mock_fs({
      '/stack/smtp/architect.yml': smtp_config,
      '/stack/upstream/architect.yml': upstream_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'smtp': '/stack/smtp/architect.yml',
      'upstream': '/stack/upstream/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('smtp'),
      await manager.loadComponentSpec('upstream'),
    ]);

    const mail_ref = resourceRefToNodeRef('smtp.services.maildev');
    const app_ref = resourceRefToNodeRef('upstream.services.test-app');

    const test_node = graph.getNodeByRef(app_ref) as ServiceNode;
    expect(test_node.config.environment).to.deep.eq({
      SMTP_ADDR: `smtp://test-user:test-pass@${mail_ref}:1025`,
      SMTP_USER: 'test-user',
      SMTP_PASS: 'test-pass',
    });
  });

  it('service interface with path', async () => {
    const component_config = `
    name: hello-world
    services:
      app:
        environment:
          API_PATH: \${{ services.api.interfaces.main.path }}
          API_ADDR: \${{ services.api.interfaces.main.url }}
      api:
        interfaces:
          main:
            port: 8080
            path: /api
        environment:
          MY_PATH: \${{ services.api.interfaces.main.path }}
          MY_ADDR: \${{ services.api.interfaces.main.url }}
    `;

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph(
      await manager.loadComponentSpecs('hello-world'));
    const template = await DockerComposeUtils.generate(graph);

    const api_ref = resourceRefToNodeRef('hello-world.services.api');
    expect(template.services[api_ref].environment).to.deep.eq({
      MY_PATH: '/api',
      MY_ADDR: `http://${api_ref}:8080/api`,
    });

    const app_ref = resourceRefToNodeRef('hello-world.services.app');
    expect(template.services[app_ref].environment).to.deep.eq({
      API_PATH: '/api',
      API_ADDR: `http://${api_ref}:8080/api`,
    });
  });

  it('interfaces with same subdomain and different paths', async () => {
    const component_config = `
    name: hello-world
    interfaces:
      api:
        url: \${{ services.api.interfaces.main.url }}
        ingress:
          enabled: true
          subdomain: cloud
          path: /api
      api2:
        url: \${{ services.api.interfaces.main.url }}
        ingress:
          enabled: true
          subdomain: cloud
          path: /api2
    services:
      api:
        interfaces:
          main: 8080
        environment:
          EXT_ADDR: \${{ ingresses.api.url }}
          EXT_ADDR2: \${{ ingresses.api2.url }}
    `;

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph(
      await manager.loadComponentSpecs('hello-world'));
    const api_ref = resourceRefToNodeRef('hello-world.services.api');

    const template = await DockerComposeUtils.generate(graph);
    expect(template.services[api_ref].environment).to.deep.eq({
      EXT_ADDR: 'http://cloud.arc.localhost/api',
      EXT_ADDR2: 'http://cloud.arc.localhost/api2',
    });
    expect(template.services[api_ref].labels).to.include(`traefik.http.routers.${api_ref}-api.rule=Host(\`cloud.arc.localhost\`) && PathPrefix(\`/api\`)`);
    expect(template.services[api_ref].labels).to.include(`traefik.http.routers.${api_ref}-api2.rule=Host(\`cloud.arc.localhost\`) && PathPrefix(\`/api2\`)`);
  });

  it('error on interfaces with same subdomain and same path', async () => {
    const component_config = `
    name: hello-world
    interfaces:
      api:
        url: \${{ services.api.interfaces.main.url }}
        ingress:
          enabled: true
          subdomain: cloud
          path: /api
      api2:
        url: \${{ services.api.interfaces.main.url }}
        ingress:
          enabled: true
          subdomain: cloud
          path: /api
    services:
      api:
        interfaces:
          main: 8080
    `;

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'hello-world': '/stack/architect.yml',
    });
    let err;
    try {
      await manager.getGraph(await manager.loadComponentSpecs('hello-world'));
    } catch (e: any) {
      err = e;
    }
    expect(err).instanceOf(ArchitectError);
  });

  it('validation error on interfaces for invalid subdomain passed through secrets', async () => {
    const component_config = `
    name: hello-world
    secrets:
      subdomain: not_ok
    interfaces:
      api:
        url: \${{ services.api.interfaces.main.url }}
        ingress:
          enabled: true
          subdomain: \${{ secrets.subdomain }}
          path: /api
    services:
      api:
        interfaces:
          main: 8080
    `;

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'hello-world': '/stack/architect.yml',
    });
    let err;
    try {
      await manager.getGraph(await manager.loadComponentSpecs('hello-world'));
    } catch (e: any) {
      err = e;
    }
    expect(err).instanceOf(ValidationErrors);
  });

  it('maps ok on interfaces for valid subdomain passed through secrets', async () => {
    const component_config = `
    name: hello-world
    secrets:
      subdomain: is-ok
    interfaces:
      api:
        url: \${{ services.api.interfaces.main.url }}
        ingress:
          subdomain: \${{ secrets.subdomain }}
    services:
      api:
        interfaces:
          main: 8080
        environment:
          EXT_ADDR: \${{ ingresses.api.url }}
    `;

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph(
      await manager.loadComponentSpecs('hello-world'));
    const api_ref = resourceRefToNodeRef('hello-world.services.api');

    const template = await DockerComposeUtils.generate(graph);
    expect(template.services[api_ref].environment).to.deep.eq({
      EXT_ADDR: 'http://is-ok.arc.localhost',
    });
  });

});
