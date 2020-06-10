import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Build from '../../src/commands/build';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import * as DockerCompose from '../../src/common/docker-compose';
import { ServiceNode } from '../../src/dependency-manager/src';

describe('interpolation', () => {
  beforeEach(() => {
    // Stub the logger
    sinon.replace(Build.prototype, 'log', sinon.stub());
    moxios.install();

    moxios.stubRequest(`/v1/auth/approle/login`, {
      status: 200,
      response: { auth: {} }
    });
  });

  afterEach(() => {
    // Restore stubs
    sinon.restore();
    // Restore fs
    mock_fs.restore();
    moxios.uninstall();
  });

  it('interpolation vault', async () => {
    const component_config = {
      name: 'architect/cloud',
      parameters: {
        auth0_secret_id: {
          required: true
        }
      },
      services: {
        app: {
          interfaces: {
            main: 8080
          },
          environment: {
            AUTH0_SECRET_ID: '${ parameters.auth0_secret_id }'
          }
        }
      }
    };

    const env_config = {
      parameters: {
        cloud_auth0_secret_id: '${ vaults.local_vault.secrets/keys#auth0_secret_id }'
      },
      components: {
        'architect/cloud': {
          extends: 'file:.',
          parameters: {
            auth0_secret_id: '${ parameters.cloud_auth0_secret_id }'
          }
        }
      },
      vaults: {
        local_vault: {
          host: 'https://vault.localhost/',
          type: 'hashicorp-vault',
          description: 'Secret store for local development',
          role_id: '<role_id>',
          secret_id: 'file:./secrets/vault-secret'
        }
      }
    };

    moxios.stubRequest(`/v1/secrets/data/keys`, {
      status: 200,
      response: { data: { data: { auth0_secret_id: 'worked' } } }
    });

    mock_fs({
      '/stack/architect.json': JSON.stringify(component_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
      '/stack/secrets/vault-secret': '<secret_id>'
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const graph = await manager.getGraph();
    expect(graph.nodes).length(1);
    expect(graph.nodes[0].ref).eq('architect/cloud/app:latest')
    expect(graph.edges).length(0);
    const app_node = graph.nodes[0] as ServiceNode;
    expect(app_node.node_config.getEnvironmentVariables()['AUTH0_SECRET_ID']).eq('worked')

    const template = await DockerCompose.generate(manager);
    expect(template).to.be.deep.equal({
      'services': {
        'architect.cloud.app.latest': {
          'depends_on': [],
          'environment': {
            'AUTH0_SECRET_ID': 'worked',
            'HOST': 'architect.cloud.app.latest',
            'PORT': '8080'
          },
          'ports': [
            '50000:8080'
          ]
        },
      },
      'version': '3',
      'volumes': {},
    })
  });
});
