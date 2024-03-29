import { expect } from '@oclif/test';
import axios from 'axios';
import yaml from 'js-yaml';
import mock_fs from 'mock-fs';
import nock from 'nock';
import path from 'path';
import { IngressEdge, resourceRefToNodeRef, ServiceNode, TaskNode, ValidationErrors } from '../../src';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../../src/common/docker-compose';
import DockerComposeTemplate from '../../src/common/docker-compose/template';

describe('components spec v1', function () {
  describe('standard components', function () {
    it('simple local component', async () => {
      const component_config_yml = `
        name: cloud
        services:
          app:
            interfaces:
              main: 8080
          api:
            interfaces:
              main: 8080
      `;

      mock_fs({
        '/stack/architect.yml': component_config_yml,
      });

      const manager = new LocalDependencyManager(axios.create(), 'architect', {
        'cloud': '/stack',
      });
      const graph = await manager.getGraph([
        await manager.loadComponentSpec('cloud:latest'),
      ]);

      const app_ref = resourceRefToNodeRef('cloud.services.app');
      const api_ref = resourceRefToNodeRef('cloud.services.api');

      expect(graph.nodes.map((n) => n.ref)).has.members([
        app_ref,
        api_ref,
      ]);
      expect(graph.edges.map((e) => e.toString())).has.members([]);

      const template = await DockerComposeUtils.generate(graph);
      const expected_compose: DockerComposeTemplate = {
        'services': {
          [app_ref]: {
            'environment': {},
            'ports': [
              '50000:8080',
            ],
            'build': {
              'context': path.resolve('/stack'),
              "labels": [
                "architect.io",
                "architect.component=cloud"
              ],
            },
            'image': app_ref,
            labels: ['architect.ref=cloud.services.app'],
          },
          [api_ref]: {
            'environment': {},
            'ports': [
              '50001:8080',
            ],
            'build': {
              'context': path.resolve('/stack'),
              "labels": [
                "architect.io",
                "architect.component=cloud"
              ],
            },
            image: api_ref,
            labels: ['architect.ref=cloud.services.api'],
          },
        },
        'version': '3',
        'volumes': {},
      };
      expect(template).to.be.deep.equal(expected_compose);
    });

    it('simple remote component', async () => {
      const component_config_json = {
        name: 'cloud',
        services: {
          app: {
            interfaces: {
              main: 8080,
            },
          },
          api: {
            interfaces: {
              main: 8080,
            },
          },
        },
      };

      nock('http://localhost').get(`/accounts/architect/components/cloud/versions/v1`)
        .reply(200, { tag: 'v1', config: component_config_json, service: { url: 'cloud:v1' } });

      const manager = new LocalDependencyManager(axios.create(), 'architect');

      const graph = await manager.getGraph([
        await manager.loadComponentSpec('cloud:v1'),
      ]);
      const app_ref = resourceRefToNodeRef('cloud.services.app');
      const api_ref = resourceRefToNodeRef('cloud.services.api');

      expect(graph.nodes.map((n) => n.ref)).has.members([
        app_ref,
        api_ref,
      ]);
      expect(graph.edges.map((e) => e.toString())).has.members([]);
    });

    it('simple remote component with override', async () => {
      const component_config = {
        name: 'cloud',
        secrets: {
          log_level: 'info',
        },
        services: {
          app: {
            interfaces: {
              main: 8080,
            },
            environment: {
              LOG_LEVEL: '${{ secrets.log_level }}',
            },
          },
        },
      };

      nock('http://localhost').get(`/accounts/architect/components/cloud/versions/v1`)
        .reply(200, { tag: 'v1', config: component_config, service: { url: 'cloud:v1' } });

      const manager = new LocalDependencyManager(axios.create(), 'architect');

      const graph = await manager.getGraph([
        await manager.loadComponentSpec('cloud:v1'),
      ], { '*': { log_level: 'debug' } });
      const app_ref = resourceRefToNodeRef('cloud.services.app');
      expect(graph.nodes.map((n) => n.ref)).has.members([app_ref]);
      expect(graph.edges.map((e) => e.toString())).has.members([]);
      const app_node = graph.getNodeByRef(app_ref) as ServiceNode;
      expect(app_node.config.environment.LOG_LEVEL).eq('debug');
    });

    it('local component with edges', async () => {
      const component_config = {
        name: 'cloud',
        services: {
          app: {
            interfaces: {
              main: 8080,
            },
            depends_on: ['api'],
            environment: {
              API_ADDR: '${{ services.api.interfaces.main.url }}',
            },
          },
          api: {
            interfaces: {
              main: 8080,
            },
            depends_on: ['db'],
            environment: {
              DB_ADDR: '${{ services.db.interfaces.main.url }}',
            },
          },
          db: {
            interfaces: {
              main: 5432,
            },
            liveness_probe: {
              command: 'pg_isready -d test'
            }
          },
        },
        interfaces: {},
      };

      mock_fs({
        '/stack/architect.yml': yaml.dump(component_config),
      });

      const manager = new LocalDependencyManager(axios.create(), 'architect', {
        'cloud': '/stack/architect.yml',
      });
      const graph = await manager.getGraph([
        await manager.loadComponentSpec('cloud:latest'),
      ]);
      const app_ref = resourceRefToNodeRef('cloud.services.app');
      const api_ref = resourceRefToNodeRef('cloud.services.api');
      const db_ref = resourceRefToNodeRef('cloud.services.db');
      expect(graph.nodes.map((n) => n.ref)).has.members([
        app_ref,
        api_ref,
        db_ref,
      ]);
      expect(graph.edges.map((e) => e.toString())).has.members([
        `service: ${app_ref} -> ${api_ref}[main]`,
        `service: ${api_ref} -> ${db_ref}[main]`,
      ]);
      // Test secret values
      const app_node = graph.getNodeByRef(app_ref) as ServiceNode;
      expect(app_node.config.environment.API_ADDR).eq(`http://${api_ref}:8080`);

      const api_node = graph.getNodeByRef(api_ref) as ServiceNode;
      expect(api_node.config.environment.DB_ADDR).eq(`http://${db_ref}:5432`);

      const template = await DockerComposeUtils.generate(graph);
      const expected_compose: DockerComposeTemplate = {
        'services': {
          [api_ref]: {
            depends_on: {
              [db_ref]: {
                condition: 'service_healthy'
              }
            },
            'environment': {
              'DB_ADDR': `http://${db_ref}:5432`,
            },
            'ports': [
              '50001:8080',
            ],
            'build': {
              'context': path.resolve('/stack'),
              "labels": [
                "architect.io",
                "architect.component=cloud"
              ],
            },
            image: api_ref,
            labels: ['architect.ref=cloud.services.api'],
          },
          [app_ref]: {
            depends_on: {
              [api_ref]: {
                condition: 'service_started'
              }
            },
            'environment': {
              'API_ADDR': `http://${api_ref}:8080`,
            },
            'ports': [
              '50000:8080',
            ],
            'build': {
              'context': path.resolve('/stack'),
              "labels": [
                "architect.io",
                "architect.component=cloud"
              ],
            },
            image: app_ref,
            labels: ['architect.ref=cloud.services.app'],
          },
          [db_ref]: {
            'environment': {},
            'ports': [
              '50002:5432',
            ],
            'build': {
              'context': path.resolve('/stack'),
              "labels": [
                "architect.io",
                "architect.component=cloud"
              ],
            },
            image: db_ref,
            labels: ['architect.ref=cloud.services.db'],
            healthcheck: {
              interval: '30s',
              retries: 3,
              start_period: '0s',
              test: ['CMD', 'pg_isready', '-d', 'test'],
              timeout: '5s'
            }
          },
        },
        'version': '3',
        'volumes': {},
      };
      expect(template).to.be.deep.equal(expected_compose);
    });

    it('local component with local dependency', async () => {
      const cloud_component_config = {
        name: 'cloud',
        services: {
          api: {
            interfaces: {
              main: 8080,
            },
            environment: {
              CONCOURSE_ADDR: '${{ dependencies.ci.interfaces.web.url }}',
            },
          },
        },
        dependencies: {
          'ci': {},
        },
        interfaces: {},
      };

      const concourse_component_config = {
        name: 'ci',
        services: {
          web: {
            interfaces: {
              main: 8080,
            },
            image: 'concourse/concourse:6.2',
          },
          worker: {
            interfaces: {},
            image: 'concourse/concourse:6.2',
            environment: {
              CONCOURSE_TSA_HOST: '${{ services.web.interfaces.main.host }}',
            },
          },
        },
        interfaces: {
          web: '${{ services.web.interfaces.main.url }}',
        },
      };

      mock_fs({
        '/stack/cloud/architect.yml': yaml.dump(cloud_component_config),
        '/stack/concourse/architect.yml': yaml.dump(concourse_component_config),
      });

      const manager = new LocalDependencyManager(axios.create(), 'architect', {
        'cloud': '/stack/cloud/architect.yml',
        'ci': '/stack/concourse/architect.yml',
      });
      const graph = await manager.getGraph([
        ...await manager.loadComponentSpecs('cloud:latest'),
      ]);
      const api_ref = resourceRefToNodeRef('cloud.services.api');
      const web_ref = resourceRefToNodeRef('ci.services.web');
      const worker_ref = resourceRefToNodeRef('ci.services.worker');

      expect(graph.nodes.map((n) => n.ref)).has.members([
        api_ref,

        web_ref,
        worker_ref,
      ]);
      expect(graph.edges.map((e) => e.toString())).has.members([
        `service: ${worker_ref} -> ${web_ref}[main]`,
        `service: ${api_ref} -> ${web_ref}[web]`,
      ]);

      // Test secret values
      const api_node = graph.getNodeByRef(api_ref) as ServiceNode;
      expect(api_node.config.environment.CONCOURSE_ADDR).eq(`http://${web_ref}:8080`);
      expect(api_node.config.name).to.eq('api');
      expect(api_node.config.metadata.tag).to.eq('latest');
      expect(api_node.config.metadata.ref).to.eq('cloud.services.api');
      const worker_node = graph.getNodeByRef(worker_ref) as ServiceNode;
      expect(worker_node.config.environment.CONCOURSE_TSA_HOST).eq(web_ref);
      expect(worker_node.config.name).to.eq('worker');
      expect(worker_node.config.metadata.tag).to.eq('latest');
      expect(worker_node.config.metadata.ref).to.eq('ci.services.worker');
    });

    it('circular component dependency is not rejected', async () => {
      const component_config = {
        name: 'hello-world',
        services: {
          api: {
            interfaces: {
              main: 8080,
            },
          },
        },
        interfaces: {},
        dependencies: {
          'hello-world2': 'latest',
        },
      };

      const component_config2 = {
        name: 'hello-world2',
        services: {
          api: {
            interfaces: {
              main: 8080,
            },
          },
        },
        interfaces: {},
        dependencies: {
          'hello-circular-world': 'latest',
        },
      };

      const circular_component_config = {
        name: 'hello-circular-world',
        services: {
          api: {
            interfaces: {
              main: 8080,
            },
          },
        },
        interfaces: {},
        dependencies: {
          'hello-world': 'latest',
        },
      };

      mock_fs({
        '/stack/architect.yml': yaml.dump(component_config),
      });

      nock('http://localhost').get(`/accounts/examples/components/hello-world2/versions/latest`)
        .reply(200, { tag: 'latest', config: component_config2, service: { url: 'hello-world2:latest' } });

      nock('http://localhost').get(`/accounts/examples/components/hello-circular-world/versions/latest`)
        .reply(200, { tag: 'latest', config: circular_component_config, service: { url: 'hello-circular-world:latest' } });

      const manager = new LocalDependencyManager(axios.create(), 'examples', {
        'hello-world': '/stack/architect.yml',
      });
      await manager.getGraph([
        await manager.loadComponentSpec('examples/hello-world:latest'),
        await manager.loadComponentSpec('examples/hello-world2:latest'),
        await manager.loadComponentSpec('examples/hello-circular-world:latest'),
      ]);
    });

    it('non-circular component dependency is not rejected', async () => {
      const component_config_a = {
        name: 'hello-world-a',
        services: {
          api: {
            interfaces: {
              main: 8080,
            },
          },
        },
        interfaces: {},
        dependencies: {
          'hello-world-b': 'latest',
          'hello-world-c': 'latest',
        },
      };

      const component_config_b = {
        name: 'hello-world-b',
        services: {
          api: {
            interfaces: {
              main: 8080,
            },
          },
        },
        interfaces: {},
        dependencies: {
          'hello-world-c': 'latest',
        },
      };

      const component_config_c = {
        name: 'hello-world-c',
        services: {
          api: {
            interfaces: {
              main: 8080,
            },
          },
        },
        interfaces: {},
        dependencies: {},
      };

      mock_fs({
        '/stack/architect.yml': yaml.dump(component_config_a),
      });

      nock('http://localhost').get(`/accounts/examples/components/hello-world-b/versions/latest`)
        .reply(200, { tag: 'latest', config: component_config_b, service: { url: 'hello-world-b:latest' } });

      nock('http://localhost').get(`/accounts/examples/components/hello-world-c/versions/latest`)
        .reply(200, { tag: 'latest', config: component_config_c, service: { url: 'hello-world-c:latest' } });

      const manager = new LocalDependencyManager(axios.create(), 'examples', {
        'hello-world-a': '/stack/architect.yml',
      });
      await manager.getGraph(await manager.loadComponentSpecs('hello-world-a:latest'));
    });

    it('component with only one task', async () => {
      const component_config_json = {
        name: 'cloud',
        tasks: {
          syncer: {
            schedule: '*/1 * * * *',
          },
        },
      };

      nock('http://localhost').get(`/accounts/architect/components/cloud/versions/v1`)
        .reply(200, { tag: 'v1', config: component_config_json, service: { url: 'cloud:v1' } });

      const manager = new LocalDependencyManager(axios.create(), 'architect');

      const component_config = await manager.loadComponentSpec('cloud:v1');
      const graph = await manager.getGraph([component_config]);

      const syncer_ref = resourceRefToNodeRef('cloud.tasks.syncer');

      expect(graph.nodes.map((n) => n.ref)).has.members([
        syncer_ref,
      ]);
      const task_node = graph.getNodeByRef(syncer_ref) as TaskNode;
      expect(task_node.__type).equals('task');
      expect(task_node.config.schedule).equals('*/1 * * * *');
      expect(task_node.config.name).equals('syncer');
      expect(task_node.config.metadata.ref).equals('cloud.tasks.syncer');

      expect(graph.edges.map((e) => e.toString())).has.members([]);
    });

    it('component with one task and one service', async () => {
      const component_config_json = {
        name: 'cloud',
        tasks: {
          syncer: {
            schedule: '*/1 * * * *',
          },
        },
        services: {
          app: {
            interfaces: {
              main: 8080,
            },
          },
        },
      };

      nock('http://localhost').get(`/accounts/architect/components/cloud/versions/v1`)
        .reply(200, { tag: 'v1', config: component_config_json, service: { url: 'cloud:v1' } });

      const manager = new LocalDependencyManager(axios.create(), 'architect');

      const component_config = await manager.loadComponentSpec('cloud:v1');
      const graph = await manager.getGraph([component_config]);

      const syncer_ref = resourceRefToNodeRef('cloud.tasks.syncer');
      const app_ref = resourceRefToNodeRef('cloud.services.app');

      expect(graph.nodes.map((n) => n.ref)).has.members([
        syncer_ref,
        app_ref,
      ]);
      const task_node = graph.getNodeByRef(syncer_ref) as TaskNode;
      expect(task_node.__type).equals('task');
      expect(task_node.config.schedule).equals('*/1 * * * *');
      expect(task_node.config.name).equals('syncer');

      expect(graph.edges.map((e) => e.toString())).has.members([]);
    });

    it('component B:v2 and component A with dependency B:v1', async () => {
      // TODO: Validate lack of services/tasks
      // TODO: Validate lack of image/build context
      const component_a = `
        name: component-a
        dependencies:
          component-b: v1
        services:
          app:
            image: test:v1
        `;

      const component_b_v1 = `
        name: component-b
        secrets:
          test_required:
        services:
          api:
            image: test:v1
            environment:
              TEST_REQUIRED: \${{ secrets.test_required }}
        `;

      const component_b_v2 = `
        name: component-b
        secrets:
          test_required:
        services:
          api:
            image: test:v2
            environment:
              TEST_REQUIRED: \${{ secrets.test_required }}
        `;

      nock('http://localhost').get(`/accounts/examples/components/component-a/versions/v1`)
        .reply(200, { tag: 'v1', config: yaml.load(component_a), service: { url: 'component-a:v1' } });

      nock('http://localhost').get(`/accounts/examples/components/component-b/versions/v1`)
        .reply(200, { tag: 'v1', config: yaml.load(component_b_v1), service: { url: 'component-b:v1' } });

      nock('http://localhost').get(`/accounts/examples/components/component-b/versions/v2`)
        .reply(200, { tag: 'v2', config: yaml.load(component_b_v2), service: { url: 'component-b:v2' } });

      const manager = new LocalDependencyManager(axios.create(), 'examples');
      const graph = await manager.getGraph([
        await manager.loadComponentSpec('component-a:v1'),
        await manager.loadComponentSpec('component-b:v1'),
        await manager.loadComponentSpec('component-b:v2@v2'),
      ], {
        '*': { test_required: 'foo1' },
        'component-b': {
          test_required: 'foo3',
        },
        'component-b@v2': {
          test_required: 'foo2',
        },
      });

      const api_ref = resourceRefToNodeRef('component-b.services.api');
      const api2_ref = resourceRefToNodeRef('component-b.services.api@v2');

      const node_b_v1 = graph.getNodeByRef(api_ref) as ServiceNode;
      expect(node_b_v1.config.environment.TEST_REQUIRED).to.eq('foo3');
      const node_b_v2 = graph.getNodeByRef(api2_ref) as ServiceNode;
      expect(node_b_v2.config.environment.TEST_REQUIRED).to.eq('foo2');
    });

    it('environment ingress context produces the correct values for a simple external interface', async () => {
      const cloud_component_config = {
        name: 'cloud',
        services: {
          api: {
            interfaces: {
              main: 8080,
            },
            environment: {
              EXTERNAL_APP_URL: '${{ ingresses[\'api-interface\'].url }}',
              EXTERNAL_APP_URL2: '${{ environment.ingresses[\'cloud\'][\'api-interface\'].url }}',
            },
          },
        },
        interfaces: {
          'api-interface': '${{ services.api.interfaces.main.url }}',
        },
      };

      mock_fs({
        '/stack/cloud/architect.yml': yaml.dump(cloud_component_config),
      });

      const manager = new LocalDependencyManager(axios.create(), 'architect', { 'cloud': '/stack/cloud/architect.yml' });
      const graph = await manager.getGraph([
        await manager.loadComponentSpec('cloud:latest', { interfaces: { api: 'api-interface' } }),
      ]);

      const api_ref = resourceRefToNodeRef('cloud.services.api');

      expect(graph.edges.filter(e => e instanceof IngressEdge).length).eq(1);
      const cloud_api_node = graph.getNodeByRef(api_ref) as ServiceNode;
      expect(cloud_api_node.config.environment.EXTERNAL_APP_URL).eq('http://api.arc.localhost');
      expect(cloud_api_node.config.environment.EXTERNAL_APP_URL2).eq('http://api.arc.localhost');
    });

    it('component with deep dependencies', async () => {
      const component_a = `
      name: component-a
      dependencies:
        component-b: latest
      services:
        app:
          image: test:v1
      `;

      const component_b = `
      name: component-b
      dependencies:
        component-c: latest
      services:
        api:
          image: test:v1
      `;

      const component_c = `
      name: component-c
      services:
        api:
          image: test:v1
      `;

      mock_fs({
        '/a/architect.yaml': component_a,
        '/b/architect.yaml': component_b,
        '/c/architect.yaml': component_c,
      });

      const manager = new LocalDependencyManager(axios.create(), 'examples', {
        'component-a': '/a/architect.yaml',
        'component-b': '/b/architect.yaml',
        'component-c': '/c/architect.yaml',
      });
      const graph = await manager.getGraph([
        ...await manager.loadComponentSpecs('component-a'),
      ]);

      const a_ref = resourceRefToNodeRef('component-a.services.app');
      const b_ref = resourceRefToNodeRef('component-b.services.api');
      const c_ref = resourceRefToNodeRef('component-c.services.api');

      expect(graph.nodes.map((n) => n.ref)).has.members([
        a_ref,
        b_ref,
        c_ref,
      ]);
    });

    it('components with shared dependencies', async () => {
      const component_a = `
      name: component-a
      dependencies:
        component-c: latest
      services:
        app:
          image: test:v1
          environment:
            C_ADDR: \${{ dependencies.component-c.interfaces.api.url }}
            C_EXT_ADDR: \${{ dependencies.component-c.ingresses.api.url }}
      `;

      const component_b = `
      name: component-b
      dependencies:
        component-c: latest
      services:
        api:
          image: test:v1
          environment:
            C_ADDR: \${{ dependencies.component-c.interfaces.api.url }}
            C_EXT_ADDR: \${{ dependencies.component-c.ingresses.api.url }}
      `;

      const component_c = `
      name: component-c
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

      const manager = new LocalDependencyManager(axios.create(), 'examples', {
        'component-a': '/a/architect.yaml',
        'component-b': '/b/architect.yaml',
        'component-c': '/c/architect.yaml',
      });
      const graph = await manager.getGraph([
        ...await manager.loadComponentSpecs('component-a'),
        ...await manager.loadComponentSpecs('component-b'),
      ]);

      const a_ref = resourceRefToNodeRef('component-a.services.app');
      const b_ref = resourceRefToNodeRef('component-b.services.api');
      const c_ref = resourceRefToNodeRef('component-c.services.api');

      const a_node = graph.getNodeByRef(a_ref) as ServiceNode;
      expect(a_node.config.environment).to.deep.equal({
        C_ADDR: `http://${c_ref}:8080`,
        C_EXT_ADDR: `http://api.arc.localhost`,
      });

      const b_node = graph.getNodeByRef(b_ref) as ServiceNode;
      expect(b_node.config.environment).to.deep.equal({
        C_ADDR: `http://${c_ref}:8080`,
        C_EXT_ADDR: `http://api.arc.localhost`,
      });
    });

    it('validation does not run if validate is set to false', async () => {
      const component_config_yml = `
        name: cloud
        secrets:
          app_replicas:
            default: 1
        services:
          app:
            interfaces:
              main: 8080
            replicas: \${{ secrets.app_replicas }}
      `;

      mock_fs({
        '/stack/architect.yml': component_config_yml,
      });

      const manager = new LocalDependencyManager(axios.create(), 'architect', {
        'cloud': '/stack',
      });
      const config = await manager.loadComponentSpec('cloud:latest');

      await manager.getGraph([config], { '*': { app_replicas: '<redacted>' } }, { interpolate: true, validate: false });
    });

    it('test backward compatibilty when still including account name with dependencies', async () => {
      // This test still uses account name in components/dependencies to verify backwards compatibility
      // in parsing and confirming account name is ignored when building slug refs
      const combinations = [
        {
          cloud: 'architect/cloud',
          api: 'architect/cloud-api',
          dependency: 'architect/cloud-api',
          account: 'architect',
        },
        {
          cloud: 'architect/cloud',
          api: 'cloud-api',
          dependency: 'architect/cloud-api',
          account: 'architect',
        },
        {
          cloud: 'architect/cloud',
          api: 'architect/cloud-api',
          dependency: 'cloud-api',
          account: 'architect',
        },
        {
          cloud: 'architect/cloud',
          api: 'cloud-api',
          dependency: 'cloud-api',
          account: 'architect',
        },
      ];

      for (const combination of combinations) {
        const cloud_component_config_yml = `
        name: ${combination.cloud}
        dependencies:
          ${combination.dependency}: latest
        services:
          app:
            interfaces:
              main: 8080
            environment:
              API_ADDR: \${{ dependencies.${combination.dependency}.interfaces.api.url }}
              EXT_API_ADDR: \${{ dependencies.${combination.dependency}.ingresses.api.url }}
      `;
        const api_component_config_yml = `
        name: ${combination.api}
        secrets:
          api_replicas:
            default: 1
        interfaces:
          api: \${{ services.api.interfaces.main.url }}
        services:
          api:
            replicas: \${{ secrets.api_replicas }}
            interfaces:
              main: 8080
            environment:
              CORS: \${{ ingresses.api.consumers }}
      `;

        mock_fs({
          '/stack/cloud/architect.yml': cloud_component_config_yml,
          '/stack/api/architect.yml': api_component_config_yml,
        });

        const manager = new LocalDependencyManager(axios.create(), 'architect', {
          'cloud': '/stack/cloud',
          'cloud-api': '/stack/api',
        });
        manager.account = combination.account;
        const configs = await manager.loadComponentSpecs(`${combination.cloud}:latest`);

        const graph = await manager.getGraph(configs, { [combination.dependency]: { api_replicas: 2 } });
        const api_node_ref = resourceRefToNodeRef('cloud-api.services.api');
        expect(graph.nodes.map((node) => node.ref)).to.have.members([
          'gateway',
          resourceRefToNodeRef('cloud.services.app'),
          api_node_ref,
        ]);

        expect(graph.edges).lengthOf(3);

        const api_node = graph.getNodeByRef(api_node_ref) as ServiceNode;
        expect(api_node.config.replicas).to.equal(2);
      }
    });

    it('component with dependency to deprecated interfaces', async () => {
      const component_a = `
      name: component-a
      dependencies:
        component-b: latest
      services:
        app:
          image: test:v1
          environment:
            B_ADDR: \${{ dependencies.component-b.services.api.interfaces.main.url }}
            B_EXT_ADDR: \${{ dependencies.component-b.services.api.interfaces.main.ingress.url }}
      `;

      const component_b = `
      name: component-b
      services:
        api:
          image: test:v1
          interfaces:
            main: 3000
      interfaces:
        main:
          url: \${{ services.api.interfaces.main.url }}
          ingress:
            subdomain: api
      `;

      mock_fs({
        '/a/architect.yaml': component_a,
        '/b/architect.yaml': component_b,
      });

      const manager = new LocalDependencyManager(axios.create(), 'examples', {
        'component-a': '/a/architect.yaml',
        'component-b': '/b/architect.yaml',
      });
      const graph = await manager.getGraph([
        ...await manager.loadComponentSpecs('component-a'),
        ...await manager.loadComponentSpecs('component-b'),
      ]);

      expect(graph.edges).to.have.lengthOf(3);
      const a_ref = resourceRefToNodeRef('component-a.services.app');
      const b_ref = resourceRefToNodeRef('component-b.services.api');

      const a_node = graph.getNodeByRef(a_ref) as ServiceNode;
      expect(a_node.config.environment).to.deep.equal({
        B_ADDR: `http://${b_ref}:3000`,
        B_EXT_ADDR: `http://api.arc.localhost`,
      });
    });
  });

  describe('optional services', () => {
    it('disabled service', async () => {
      const yml = `
        name: component
        services:
          app:
            enabled: false
        `;

      mock_fs({
        '/architect.yaml': yml,
      });

      const manager = new LocalDependencyManager(axios.create(), 'examples', {
        'component': '/architect.yaml',
      });
      const graph = await manager.getGraph([
        ...await manager.loadComponentSpecs('component'),
      ]);

      expect(graph.nodes).to.have.lengthOf(0);
    });

    it('cannot interpolate disabled service', async () => {
      const yml = `
        name: component
        services:
          app:
            environment:
              API_ADDR: \${{ services.api.interfaces.main.url }}
          api:
            enabled: false
            interfaces:
              main: 8080
        `;

      mock_fs({
        '/architect.yaml': yml,
      });

      const manager = new LocalDependencyManager(axios.create(), 'examples', {
        'component': '/architect.yaml',
      });

      let error;
      try {
        await manager.getGraph([
          ...await manager.loadComponentSpecs('component'),
        ])
      } catch (err) {
        error = err;
      }

      expect(error).to.be.instanceOf(ValidationErrors);
    });

    it('service still runs since interpolation is in debug block', async () => {
      const yml = `
        name: component
        services:
          app:
            debug:
              environment:
                API_ADDR: \${{ services.api.interfaces.main.url }}
          api:
            enabled: false
            interfaces:
              main: 8080
        `;

      mock_fs({
        '/architect.yaml': yml,
      });

      const manager = new LocalDependencyManager(axios.create(), 'examples', {
        'component': '/architect.yaml',
      });

      await manager.getGraph([
        ...await manager.loadComponentSpecs('component'),
      ])
    });

    it('optional downstream service debug=true', async () => {
      const yml = `
        name: component

        services:
          app:
            debug:
              environment:
                API_ADDR: \${{ services.api.interfaces.main.url }}
          api:
            enabled: false
            interfaces:
              main: 8080
            debug:
              enabled: true
        `;

      mock_fs({
        '/architect.yaml': yml,
      });

      const manager = new LocalDependencyManager(axios.create(), 'examples', {
        'component': '/architect.yaml',
      });

      const graph = await manager.getGraph([
        ...await manager.loadComponentSpecs('component', true),
      ]);

      expect(graph.nodes).to.have.lengthOf(2);
      expect(graph.edges).to.have.lengthOf(1);
    });

    it('connect databases to services', async () => {
      const yml = `
        name: component

        databases:
          primary-db:
            type: mariadb:10

        services:
          api:
            image: test:v1
            environment:
              DATABASE: \${{ databases['primary-db'].connection_string }}
        `;

      mock_fs({
        '/architect.yaml': yml,
      });

      const manager = new LocalDependencyManager(axios.create(), 'examples', {
        'component': '/architect.yaml',
      });

      const graph = await manager.getGraph([
        ...await manager.loadComponentSpecs('component', true),
      ]);

      expect((graph.nodes[0] as any).config.environment.DATABASE).to.be.equal('mariadb://architect:password@component--primary-db-db:3306/architect');
      expect(graph.nodes).to.have.lengthOf(2);
      expect(graph.edges).to.have.lengthOf(1);
    });

    it('override database with secret', async () => {
      const yml = `
        name: component

        secrets:
          dbOverride:
            default: mysql://default.com

        databases:
          primary:
            type: mariadb:10
            connection_string: \${{ secrets.dbOverride }}

        services:
          api:
            image: test:v1
            environment:
              DATABASE: \${{ databases.primary.connection_string }}
        `;

      mock_fs({
        '/architect.yaml': yml,
      });

      const manager = new LocalDependencyManager(axios.create(), 'examples', {
        'component': '/architect.yaml',
      });

      const override_url = 'https://override.com';
      const graph = await manager.getGraph([
        ...await manager.loadComponentSpecs('component', true),
      ], {
        '*': { 'dbOverride': override_url }
      });

      expect((graph.nodes[0] as any).config.environment.DATABASE).to.be.equal(override_url);
      expect(graph.edges).to.have.length(1);
    });

    it('override database with default value', async () => {
      const default_value = 'mysql://default.com';
      const yml = `
        name: component

        secrets:
          dbOverride:
            default: ${default_value}

        databases:
          primary:
            type: mariadb:10
            connection_string: \${{ secrets.dbOverride }}

        services:
          api:
            image: test:v1
            environment:
              DATABASE: \${{ databases.primary.connection_string }}
        `;

      mock_fs({
        '/architect.yaml': yml,
      });

      const manager = new LocalDependencyManager(axios.create(), 'examples', {
        'component': '/architect.yaml',
      });

      const graph = await manager.getGraph([
        ...await manager.loadComponentSpecs('component', true),
      ]);

      expect((graph.nodes[0] as any).config.environment.DATABASE).to.be.equal(default_value);
      expect(graph.edges).to.have.length(1);
    });

    it('throw error if database override not a valid url', async () => {
      const yml = `
        name: component

        databases:
          primary:
            type: mariadb:10
            connection_string: \${{ secrets.dbOverride }}

        services:
          api:
            image: test:v1
            environment:
              DATABASE: \${{ databases.primary.connection_string }}
        `;

      mock_fs({
        '/architect.yaml': yml,
      });

      const manager = new LocalDependencyManager(axios.create(), 'examples', {
        'component': '/architect.yaml',
      });

      let error;
      try {
        await manager.getGraph([
          ...await manager.loadComponentSpecs('component'),
        ], {
          '*': { 'dbOverride': 'garbage' }
        })
      } catch (err) {
        error = err;
      }

      expect(error).to.be.instanceOf(ValidationErrors);
    });

    it('throw error if database and service names collide', async () => {
      const yml = `
        name: component

        databases:
          primary:
            type: mariadb:10
            connection_string: \${{ secrets.dbOverride }}

        services:
          primary-db:
            image: test:v1
          api:
            image: test:v1
            environment:
              DATABASE: \${{ databases.primary.connection_string }}
        `;

      mock_fs({
        '/architect.yaml': yml,
      });

      const manager = new LocalDependencyManager(axios.create(), 'examples', {
        'component': '/architect.yaml',
      });

      let error;
      try {
        await manager.getGraph([
          ...await manager.loadComponentSpecs('component'),
        ])
      } catch (err) {
        error = err;
      }

      expect(error).to.be.instanceOf(ValidationErrors);
    });
  })
});
