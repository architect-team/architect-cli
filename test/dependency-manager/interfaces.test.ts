/**
 * @format
 */
import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Register from '../../src/commands/register';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import * as DockerCompose from '../../src/common/docker-compose';
import PortUtil from '../../src/common/utils/port';
import { ServiceNode } from '../../src/dependency-manager/src';

describe('interfaces spec v1', () => {
  let leaf_component = {} as any,
    branch_component = {} as any;

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
            DB_PROTOCOL: '${ services.db.interfaces.postgres.protocol }',
            DB_HOST: '${ services.db.interfaces.postgres.host }',
            DB_PORT: '${ services.db.interfaces.postgres.port }',
            DB_URL: '${ services.db.interfaces.postgres.url }',
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
            LEAF_PROTOCOL: '${ dependencies.test/leaf.interfaces.api.protocol }',
            LEAF_HOST: '${ dependencies.test/leaf.interfaces.api.host }',
            LEAF_PORT: '${ dependencies.test/leaf.interfaces.api.port }',
            LEAF_URL: '${ dependencies.test/leaf.interfaces.api.url }',
          },
        },
      },
      interfaces: {}
    };
  });

  afterEach(function () {
    // Restore stubs
    sinon.restore();
    // Restore fs
    mock_fs.restore();
    moxios.uninstall();
  });

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
      'test/leaf/api:latest [service] -> test/leaf/db:latest [postgres]',
    ])
    const api_node = graph.getNodeByRef('test/leaf/api:latest') as ServiceNode;
    expect(Object.entries(api_node.node_config.getEnvironmentVariables()).map(([k, v]) => `${k}=${v}`)).has.members([
      'DB_PROTOCOL=postgres',
      'DB_HOST=test.leaf.db.latest',
      'DB_PORT=5432',
      'DB_URL=postgres://test.leaf.db.latest:5432'
    ])
  });

  it('should connect services to dependency interfaces', async () => {
    leaf_component.interfaces = {
      api: {
        url: '${ services.api.interfaces.main.url }',
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
      'test/leaf/api:latest [service] -> test/leaf/db:latest [postgres]',
      'test/leaf:latest-interfaces [api] -> test/leaf/api:latest [main]',

      'test/branch/api:latest [service] -> test/leaf:latest-interfaces [api]',
    ])
    const branch_api_node = graph.getNodeByRef('test/branch/api:latest') as ServiceNode;
    expect(Object.entries(branch_api_node.node_config.getEnvironmentVariables()).map(([k, v]) => `${k}=${v}`)).has.members([
      'LEAF_PROTOCOL=http',
      'LEAF_HOST=test.leaf.api.latest',
      'LEAF_PORT=8080',
      'LEAF_URL=http://test.leaf.api.latest:8080'
    ])
  });

  it('should expose environment interfaces via a gateway', async () => {
    leaf_component.interfaces = {
      api: '${ services.api.interfaces.main.url }',
    };

    mock_fs({
      '/stack/leaf/architect.json': JSON.stringify(leaf_component),
      '/stack/branch/architect.json': JSON.stringify(branch_component),
      '/stack/environment.json': JSON.stringify({
        interfaces: {
          public: '${ components["test/leaf"].interfaces.api.url }',
          publicv1: '${ components["test/leaf:v1.0"].interfaces.api.url }'
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

      'test/leaf/api:latest [service] -> test/leaf/db:latest [postgres]',
      'test/leaf:latest-interfaces [api] -> test/leaf/api:latest [main]',

      'test/leaf/api:v1.0 [service] -> test/leaf/db:v1.0 [postgres]',
      'test/leaf:v1.0-interfaces [api] -> test/leaf/api:v1.0 [main]',

      'test/branch/api:latest [service] -> test/leaf:latest-interfaces [api]',
    ])
    const branch_api_node = graph.getNodeByRef('test/branch/api:latest') as ServiceNode;
    expect(Object.entries(branch_api_node.node_config.getEnvironmentVariables()).map(([k, v]) => `${k}=${v}`)).has.members([
      'LEAF_PROTOCOL=http',
      'LEAF_HOST=public.localhost',
      'LEAF_PORT=80',
      'LEAF_URL=http://public.localhost:80'
    ])

    const template = await DockerCompose.generate(manager);
    expect(Object.keys(template.services)).has.members([
      'test.branch.api.latest',
      'test.leaf.db.latest',
      'test.leaf.api.latest',
      'test.leaf.db.v1.0',
      'test.leaf.api.v1.0',
      'gateway'
    ])

    expect(template.services['test.branch.api.latest']).to.be.deep.equal({
      depends_on: ['test.leaf.api.latest'],
      environment: {
        LEAF_HOST: 'public.localhost',
        LEAF_PORT: '80',
        LEAF_PROTOCOL: 'http',
        LEAF_URL: 'http://public.localhost:80'
      },
      image: 'branch:latest',
      links: [
        'gateway:public.localhost',
        'gateway:publicv1.localhost'
      ],
      ports: []
    });

    expect(template.services['test.leaf.db.latest']).to.be.deep.equal({
      depends_on: [],
      environment: {},
      image: 'postgres:11',
      ports: ['50000:5432'],
      links: [
        'gateway:public.localhost',
        'gateway:publicv1.localhost'
      ],
    });

    expect(template.services['test.leaf.api.latest']).to.be.deep.equal({
      depends_on: ['test.leaf.db.latest', 'gateway'],
      environment: {
        DB_HOST: 'test.leaf.db.latest',
        DB_PORT: '5432',
        DB_PROTOCOL: 'postgres',
        DB_URL: 'postgres://test.leaf.db.latest:5432',
        VIRTUAL_HOST: 'public.localhost',
        VIRTUAL_PORT: '8080',
        VIRTUAL_PROTOCOL: 'http'
      },
      image: 'api:latest',
      ports: ['50001:8080'],
      restart: 'always',
      links: [
        'gateway:public.localhost',
        'gateway:publicv1.localhost'
      ],
    });

    expect(template.services['test.leaf.db.v1.0']).to.be.deep.equal({
      depends_on: [],
      environment: {},
      image: 'postgres:11',
      ports: ['50002:5432'],
      links: [
        'gateway:public.localhost',
        'gateway:publicv1.localhost'
      ],
    });

    expect(template.services['test.leaf.api.v1.0']).to.be.deep.equal({
      depends_on: ['test.leaf.db.v1.0', 'gateway'],
      environment: {
        DB_HOST: 'test.leaf.db.v1.0',
        DB_PORT: '5432',
        DB_PROTOCOL: 'postgres',
        DB_URL: 'postgres://test.leaf.db.v1.0:5432',
        VIRTUAL_HOST: 'publicv1.localhost',
        VIRTUAL_PORT: '8080',
        VIRTUAL_PROTOCOL: 'http'
      },
      image: 'api:latest',
      ports: ['50003:8080'],
      restart: 'always',
      links: [
        'gateway:public.localhost',
        'gateway:publicv1.localhost'
      ],
    });
  });
});
