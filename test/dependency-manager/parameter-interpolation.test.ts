import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Build from '../../src/commands/build';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { ServiceNode } from '../../src/dependency-manager/src';

describe('parameter-interpolation', function () {
  beforeEach(async () => {
    // Stub the logger
    sinon.replace(Build.prototype, 'log', sinon.stub());
    moxios.install();
  });

  afterEach(function () {
    // Restore stubs
    sinon.restore();
    // Restore fs
    mock_fs.restore();
    moxios.uninstall();
  });

  it('loadParameters', async () => {
    const frontend_config = {
      name: 'architect/cloud',
      interfaces: {
        app: '${ parameters.APP_PORT }'
      },
      dependencies: {
        'architect/cloud-api': '${ parameters.API_TAG }'
      },
      parameters: {
        APP_PORT: 8080,
        API_TAG: 'v1',
        DB_USER: {
          value_from: {
            datastore: 'db',
            value: '$DB_USER'
          }
        },
        DEP_DB_USER: "${ dependencies['architect/cloud-api'].parameters.DB_USER }",
        lower_dep_ADMIN_PORT: "${ dependencies['architect/cloud-api'].interfaces.admin.port }",
      },
      datastores: {
        db: {
          image: 'postgres:11',
          port: 5432,
          parameters: {
            DB_USER: 'root'
          }
        }
      }
    };

    moxios.stubRequest(`/accounts/architect/services/cloud/versions/v1`, {
      status: 200,
      response: { tag: 'v1', config: frontend_config, service: { url: 'architect/cloud:v1' } },
    });

    const backend_config = {
      name: 'architect/cloud-api',
      interfaces: {
        api: 8080,
        admin: 8081,
        primary: 8082,
      },
      parameters: {
        DB_USER: '${ dependencies.primary.parameters.DB_USER }',
      },
      dependencies: {
        primary: {
          image: 'postgres:11',
          port: 5432,
          parameters: {
            DB_USER: 'dep-root'
          }
        }
      }
    };

    moxios.stubRequest(`/accounts/architect/services/cloud-api/versions/v1`, {
      status: 200,
      response: { tag: 'v1', config: backend_config, service: { url: 'architect/cloud-api:v1' } },
    });

    const env_config = {
      services: {
        'architect/cloud:v1': {}
      }
    };

    mock_fs({
      '/stack/src/cloud/architect.json': JSON.stringify(frontend_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const default_keys = [
      'EXTERNAL_HOST',
      'INTERNAL_HOST',
      'EXTERNAL_PORT',
      'INTERNAL_PORT',
      'EXTERNAL_URL',
      'INTERNAL_URL',
      'EXTERNAL_PROTOCOL',
      'INTERNAL_PROTOCOL',
      'HOST',
      'PORT',
    ];

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json', undefined, true);
    await manager.loadParameters();
    const graph = manager.graph;
    const frontend_node = graph.nodes[0] as ServiceNode;
    const backend_node = graph.nodes[2] as ServiceNode;
    const backend_datastore_node = graph.nodes[1] as ServiceNode;
    expect(Object.keys(frontend_node.parameters)).members(['APP_PORT', 'API_TAG', 'DB_USER', 'DEP_DB_USER', 'lower_dep_ADMIN_PORT', ...default_keys]);
    expect(frontend_node.interfaces.app.port).eq(8080);
    expect(frontend_node.node_config.getDependencies()['architect/cloud-api']).eq('v1');
    expect(frontend_node.parameters['APP_PORT']).eq(8080);
    expect(frontend_node.parameters['DB_USER']).eq('root');
    expect(frontend_node.parameters['DEP_DB_USER']).eq('dep-root');
    expect(frontend_node.parameters['lower_dep_ADMIN_PORT']).eq('8081');
    expect(backend_node.parameters['PRIMARY_PORT']).eq('8082');
    expect(backend_datastore_node.parameters['PORT']).eq('5432');
  });
});
