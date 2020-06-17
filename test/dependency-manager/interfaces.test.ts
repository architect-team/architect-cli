/**
 * @format
 */
import moxios from 'moxios';
import axios from 'axios';
import sinon from 'sinon';
import mock_fs from 'mock-fs';
import PortUtil from '../../src/common/utils/port';
import Build from '../../src/commands/build';
import { expect } from '@oclif/test';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';

describe('interfaces', () => {
  beforeEach(async () => {
    // Stub the logger
    sinon.replace(Build.prototype, 'log', sinon.stub());
    moxios.install();
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

  let leaf_component = {} as any,
    branch_component = {} as any;

  it('should connect two services together', async () => {
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
          environment: {
            DB_PROTOCOL: '${ services.db.interfaces.postgres.protocol }',
            DB_HOST: '${ services.db.interfaces.postgres.host }',
            DB_PORT: '${ services.db.interfaces.postgres.port }',
            DB_URL: '${ services.db.interfaces.postgres.url }',
          },
        },
      },
    };

    mock_fs({
      '/stack/leaf/architect.json': JSON.stringify(leaf_component),
      '/stack/environment.json': JSON.stringify({
        components: {
          'test/leaf': 'latest',
        },
      }),
    });

    const manager = await LocalDependencyManager.createFromPath(
      axios.create(),
      '/stack/environment.json',
    );
    const graph = await manager.getGraph();
    expect(graph.nodes).length(2);
    expect(graph.nodes[0].ref).eq('test/leaf/api:latest');
    expect(graph.nodes[1].ref).eq('test/leaf/db:latest');
    expect(graph.edges).length(1);
    expect(graph.edges[0].from).eq('test/leaf/api:latest');
    expect(graph.edges[0].to).eq('test/leaf/db:latest');
  });

  it('should connect services to dependency interfaces', async () => {
    leaf_component.services.api.interfaces = {
      main: 8080,
    };

    leaf_component.interfaces = {
      main: '${ services.api.interfaces.main.url }',
    };

    branch_component = {
      name: 'test/branch',
      dependencies: {
        'test/leaf': 'latest',
      },
      services: {
        api: {
          image: 'branch:latest',
          environment: {
            LEAF_PROTOCOL:
              '${ dependencies.test/leaf.interfaces.main.protocol }',
            LEAF_HOST: '${ dependencies.test/leaf.interfaces.main.host }',
            LEAF_PORT: '${ dependencies.test/leaf.interfaces.main.port }',
            LEAF_URL: '${ dependencies.test/leaf.interfaces.main.url }',
          },
        },
      },
    };

    mock_fs({
      '/stack/leaf/architect.json': JSON.stringify(leaf_component),
      '/stack/branch/architect.json': JSON.stringify(branch_component),
      '/stack/environment.json': JSON.stringify({
        components: {
          'test/branch': 'latest',
        },
      }),
    });

    const manager = await LocalDependencyManager.createFromPath(
      axios.create(),
      '/stack/environment.json',
    );
    const graph = await manager.getGraph();
    expect(graph.nodes).length(3);
    expect(graph.nodes[0].ref).eq('test/leaf/api:latest');
    expect(graph.nodes[1].ref).eq('test/leaf/db:latest');
    expect(graph.nodes[2].ref).eq('test/branch/api:latest');
    expect(graph.edges).length(2);
    expect(graph.edges[0].from).eq('test/leaf/api:latest');
    expect(graph.edges[0].to).eq('test/leaf/db:latest');
    expect(graph.edges[0].from).eq('test/branch/api:latest');
    expect(graph.edges[0].to).eq('test/leaf/api:latest');
  });

  it('should expose environment interfaces via a gateway', async () => {
    branch_component.services.api.interfaces = {
      main: 8081,
    };

    branch_component.interfaces = {
      main: '${ services.api.interfaces.main.url }',
    };

    mock_fs({
      '/stack/leaf/architect.json': JSON.stringify(leaf_component),
      '/stack/branch/architect.json': JSON.stringify(branch_component),
      '/stack/environment.json': JSON.stringify({
        interfaces: {
          public: '${ components.architect/branch.interfaces.main.url }',
        },
        components: {
          'architect/branch': 'latest',
        },
      }),
    });

    const manager = await LocalDependencyManager.createFromPath(
      axios.create(),
      '/stack/environment.json',
    );
    const graph = await manager.getGraph();

    // TODO: not entirely sure how to test this, but I would assume the nginx
    // gateway would have an edge to the test/branch/api
    expect(graph.nodes).length(5);
    expect(graph.nodes[0].ref).eq('test/leaf/api:latest');
    expect(graph.nodes[1].ref).eq('test/leaf/db:latest');
    expect(graph.nodes[2].ref).eq('test/branch/api:latest');
    expect(graph.edges).length(3);
    expect(graph.edges[0].from).eq('test/leaf/api:latest');
    expect(graph.edges[0].to).eq('test/leaf/db:latest');
    expect(graph.edges[0].from).eq('test/branch/api:latest');
    expect(graph.edges[0].to).eq('test/leaf/api:latest');
  });
});
