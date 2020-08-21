import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import path from 'path';
import sinon from 'sinon';
import Register from '../../src/commands/register';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import * as DockerCompose from '../../src/common/docker-compose';
import PortUtil from '../../src/common/utils/port';
import { Refs, ServiceNode } from '../../src/dependency-manager/src';

describe('interpolation spec v1', () => {
  beforeEach(() => {
    // Stub the logger
    sinon.replace(Register.prototype, 'log', sinon.stub());
    moxios.install();

    sinon.replace(PortUtil, 'isPortAvailable', async () => true);
    PortUtil.reset();

    moxios.wait(function () {
      let request = moxios.requests.mostRecent()
      if (request) {
        request.respondWith({
          status: 404,
        })
      }
    })

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
    const url_safe_ref = Refs.url_safe_ref('concourse/web/web:latest');
    expect(template).to.be.deep.equal({
      'services': {
        'concourse--web--web--latest--62arnmmt': {
          'depends_on': [],
          'environment': {},
          'ports': [
            '50000:8080'
          ],
          'build': {
            'context': path.resolve('/stack')
          }
        },
        'concourse--worker--worker--latest--umjxggst': {
          'depends_on': [],
          'environment': {
            'REGULAR': `${url_safe_ref}:2222`,
            'SINGLE_QUOTE': `${url_safe_ref}:2222`,
            'DOUBLE_QUOTE': `${url_safe_ref}:2222`,
          },
          'ports': [],
          'build': {
            'context': path.resolve('/stack')
          }
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
    expect(public_template.services['concourse--web--web--latest--62arnmmt']).to.be.deep.equal({
      'depends_on': ['gateway'],
      'environment': {
        'VIRTUAL_HOST': 'public.localhost',
        'VIRTUAL_PORT': '8080',
        VIRTUAL_PORT_public_localhost: '8080',
        'VIRTUAL_PROTO': 'http'
      },
      links: [
        'gateway:public.localhost'
      ],
      'ports': [
        '50001:8080'
      ],
      'restart': 'always',
      'build': {
        'context': path.resolve('/stack')
      }
    })
    expect(public_template.services['concourse--worker--worker--latest--umjxggst']).to.be.deep.equal({
      'depends_on': [],
      'environment': {
        'REGULAR': 'public.localhost:2222',
        'SINGLE_QUOTE': 'public.localhost:2222',
        'DOUBLE_QUOTE': 'public.localhost:2222',
      },
      'ports': [],
      'build': {
        'context': path.resolve('/stack')
      },
      links: [
        'gateway:public.localhost'
      ],
    })
  });

  it('interpolation environment file:', async () => {
    const component_config = {
      name: 'test/component',
      interfaces: {
        main: '${ services.web.interfaces.main.url }'
      },
      parameters: {
        log_level: 'debug'
      },
      services: {
        web: {
          interfaces: {
            main: 8080
          },
          environment: {
            APPLICATION_PROPERTIES: 'file:./application.properties'
          }
        }
      }
    }

    const env_config = {
      components: {
        'test/component:latest': {
          extends: 'file:./web/web.json'
        }
      }
    };

    const properties = 'log_level=${ parameters.log_level }'

    mock_fs({
      '/stack/web/application.properties': properties,
      '/stack/web/web.json': JSON.stringify(component_config),
      '/stack/environment.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.json');
    const graph = await manager.getGraph();
    const node = graph.getNodeByRef('test/component/web:latest') as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      APPLICATION_PROPERTIES: 'log_level=debug'
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
      interfaces: {},
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
        'architect--cloud--app--latest--kavtrukr': {
          'depends_on': [],
          'environment': {
            'AUTH0_SECRET_ID': 'worked',
            'SINGLE_QUOTE': 'single',
            'DOUBLE_QUOTE': 'double',
            'JSON': '{ \"first\": \"value\",\n\"second\": \"value\" }'
          },
          'ports': [
            '50000:8080'
          ],
          'build': {
            'context': path.resolve('/stack')
          }
        },
      },
      'version': '3',
      'volumes': {},
    })
  });
});
