import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Build from '../../src/commands/build';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import * as DockerCompose from '../../src/common/docker-compose';
import PortUtil from '../../src/common/utils/port';
import { ServiceNode } from '../../src/dependency-manager/src';

describe('interpolation spec v1', () => {
  beforeEach(() => {
    // Stub the logger
    sinon.replace(Build.prototype, 'log', sinon.stub());
    moxios.install();

    sinon.replace(PortUtil, 'isPortAvailable', async () => true);
    PortUtil.reset();

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
        auth0_secret_id: {},
        json: {},
        single_quote: {},
        double_quote: {}
      },
      services: {
        app: {
          interfaces: {
            main: 8080
          },
          environment: {
            AUTH0_SECRET_ID: '${ parameters.auth0_secret_id }',
            JSON: '${ parameters.json }',
            SINGLE_QUOTE: '${ parameters.single_quote }',
            DOUBLE_QUOTE: '${ parameters.double_quote }',
          }
        }
      },
      interfaces: {}
    };

    const env_config = {
      parameters: {
        cloud_auth0_secret_id: '${ vaults.local_vault.secrets/keys#auth0_secret_id }',
      },
      components: {
        'architect/cloud': {
          extends: 'file:.',
          parameters: {
            auth0_secret_id: '${ parameters.cloud_auth0_secret_id }',
            single_quote: "${ vaults.local_vault['secrets/keys#single_quote'] }",
            double_quote: '${ vaults.local_vault["secrets/keys#double_quote"] }',
            json: '${ vaults.local_vault.secrets/keys#json }',
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
      response: {
        data: {
          data: {
            auth0_secret_id: 'worked',
            single_quote: 'single',
            double_quote: 'double',
            json: '{ "first": "value",\n"second": "value" }'
          }
        }
      }
    });

    mock_fs({
      '/stack/architect.json': JSON.stringify(component_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
      '/stack/secrets/vault-secret': '<secret_id>'
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const graph = await manager.getGraph();
    expect(graph.nodes.map((n) => n.ref)).has.members([
      'architect/cloud/app:latest',
    ])
    expect(graph.edges.map((e) => e.toString())).has.members([])
    const app_node = graph.getNodeByRef('architect/cloud/app:latest') as ServiceNode;
    expect(app_node.node_config.getEnvironmentVariables()['AUTH0_SECRET_ID']).eq('worked')

    const template = await DockerCompose.generate(manager);
    expect(template).to.be.deep.equal({
      'services': {
        'architect.cloud.app.latest': {
          'depends_on': [],
          'environment': {
            'AUTH0_SECRET_ID': 'worked',
            'SINGLE_QUOTE': 'single',
            'DOUBLE_QUOTE': 'double',
            'JSON': '{ \"first\": \"value\",\n\"second\": \"value\" }'
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
