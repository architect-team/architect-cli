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

  it('interpolation dependencies', async () => {
    const web_component_config = {
      name: 'concourse/web',
      interfaces: {
        main: '${ services.web.interfaces.main.url }'
      },
      services: {
        web: {
          interfaces: {
            main: 8080
          }
        }
      }
    }
    const worker_component_config = {
      name: 'concourse/worker',
      parameters: {
        regular: "${ dependencies.concourse/web.interfaces.main.host }:2222",
        single_quote: "${ dependencies['concourse/web'].interfaces.main.host }:2222",
        double_quote: '${ dependencies["concourse/web"].interfaces.main.host }:2222'
      },
      dependencies: {
        'concourse/web': 'latest'
      },
      services: {
        worker: {
          environment: {
            REGULAR: '${ parameters.regular }',
            SINGLE_QUOTE: '${ parameters.single_quote }',
            DOUBLE_QUOTE: '${ parameters.double_quote }',
          },
          interfaces: {}
        }
      },
      interfaces: {}
    };

    const env_config = {
      components: {
        'concourse/web:latest': {
          extends: 'file:./web.json'
        },
        'concourse/worker:latest': {
          extends: 'file:./worker.json'
        }
      }
    };

    const public_env_config = {
      ...env_config,
      interfaces: {
        public: '${ components.concourse/web:latest.interfaces.main.url }'
      }
    }

    mock_fs({
      '/stack/web.json': JSON.stringify(web_component_config),
      '/stack/worker.json': JSON.stringify(worker_component_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
      '/stack/public.arc.env.json': JSON.stringify(public_env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const graph = await manager.getGraph();
    expect(graph.nodes.map((n) => n.ref)).has.members([
      'concourse/web:latest-interfaces',
      'concourse/web/web:latest',
      'concourse/worker/worker:latest'
    ])
    expect(graph.edges.map((e) => e.toString())).has.members([
      'concourse/web:latest-interfaces [main] -> concourse/web/web:latest [main]'
    ])

    const template = await DockerCompose.generate(manager);
    expect(template).to.be.deep.equal({
      'services': {
        'concourse.web.web.latest': {
          'depends_on': [],
          'environment': {},
          'ports': [
            '50000:8080'
          ]
        },
        'concourse.worker.worker.latest': {
          'depends_on': [],
          'environment': {
            'REGULAR': 'concourse.web.web.latest:2222',
            'SINGLE_QUOTE': 'concourse.web.web.latest:2222',
            'DOUBLE_QUOTE': 'concourse.web.web.latest:2222',
          },
          'ports': []
        },
      },
      'version': '3',
      'volumes': {},
    })

    const public_manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/public.arc.env.json');
    const public_graph = await public_manager.getGraph();
    expect(public_graph.nodes.map((n) => n.ref)).has.members([
      'gateway',
      'concourse/web:latest-interfaces',
      'concourse/web/web:latest',
      'concourse/worker/worker:latest'
    ])
    expect(public_graph.edges.map((e) => e.toString())).has.members([
      'gateway [public] -> concourse/web:latest-interfaces [main]',
      'concourse/web:latest-interfaces [main] -> concourse/web/web:latest [main]',
    ])

    const public_template = await DockerCompose.generate(public_manager);
    expect(public_template.services['concourse.web.web.latest']).to.be.deep.equal({
      'depends_on': ['gateway'],
      'environment': {
        'VIRTUAL_HOST': 'public.localhost',
        'VIRTUAL_PORT': '50001'
      },
      'ports': [
        '50001:8080'
      ],
      'restart': 'always'
    })
    expect(public_template.services['concourse.worker.worker.latest']).to.be.deep.equal({
      'depends_on': [],
      'environment': {
        'REGULAR': 'public.localhost:2222',
        'SINGLE_QUOTE': 'public.localhost:2222',
        'DOUBLE_QUOTE': 'public.localhost:2222',
      },
      'ports': []
    })
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
