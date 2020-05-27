import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Build from '../../src/commands/build';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { ServiceNode } from '../../src/dependency-manager/src';

describe('parameters', function () {
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

  it('loadParameters-with-valueFrom', async () => {
    const frontend_config = {
      name: 'architect/cloud',
      interfaces: {
        app: 8080
      },
      dependencies: {
        'architect/cloud-api': 'v1'
      },
      parameters: {
        DB_USER: {
          value_from: {
            datastore: 'primary',
            value: '$DB_USER'
          }
        },
        DEP_DB_USER: {
          value_from: {
            dependency: 'architect/cloud-api',
            value: '$DB_USER'
          }
        },
        lower_dep_ADMIN_PORT: {
          value_from: {
            dependency: 'architect/cloud-api',
            interface: 'admin',
            value: '$PORT'
          }
        },
        SOME_BOOLEAN_PARAM: {
          description: "A boolean param that should end up as a string",
          default: false,
        }
      },
      datastores: {
        primary: {
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
        DB_USER: {
          value_from: {
            datastore: 'primary',
            value: '$DB_USER'
          }
        }
      },
      datastores: {
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
    expect(Object.keys(frontend_node.parameters)).members(['DB_USER', 'DEP_DB_USER', 'lower_dep_ADMIN_PORT', 'SOME_BOOLEAN_PARAM', ...default_keys]);
    expect(frontend_node.parameters['SOME_BOOLEAN_PARAM']).eq('false');
    expect(frontend_node.parameters['SOME_BOOLEAN_PARAM']).not.eq(false);
    expect(frontend_node.parameters['DB_USER']).eq('root');
    expect(frontend_node.parameters['DEP_DB_USER']).eq('dep-root');
    expect(frontend_node.parameters['lower_dep_ADMIN_PORT']).eq('8081');
    expect(backend_node.parameters['PRIMARY_PORT']).eq('8082');
    expect(backend_datastore_node.parameters['PORT']).eq('5432');
  });
});
