import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import path from 'path';
import sinon from 'sinon';
import Register from '../../src/commands/register';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../../src/common/docker-compose';
import DockerComposeTemplate, { DockerService } from '../../src/common/docker-compose/template';
import PortUtil from '../../src/common/utils/port';
import { ComponentConfig, ServiceNode } from '../../src/dependency-manager/src';

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
        main: '${{ services.web.interfaces.main.url }}'
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
        regular: '${{ dependencies.concourse/web.interfaces.main.host }}:2222',
        single_quote: "${{ dependencies['concourse/web'].interfaces.main.host }}:2222",
        double_quote: '${{ dependencies["concourse/web"].interfaces.main.host }}:2222'
      },
      dependencies: {
        'concourse/web': 'latest'
      },
      services: {
        worker: {
          environment: {
            REGULAR: '${{ parameters.regular }}',
            SINGLE_QUOTE: '${{ parameters.single_quote }}',
            DOUBLE_QUOTE: '${{ parameters.double_quote }}',
          },
          interfaces: {}
        }
      },
      interfaces: {}
    };

    mock_fs({
      '/stack/web.json': JSON.stringify(web_component_config),
      '/stack/worker.json': JSON.stringify(worker_component_config),
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'concourse/web': '/stack/web.json',
      'concourse/worker': '/stack/worker.json'
    });
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('concourse/web'),
      await manager.loadComponentConfig('concourse/worker')
    ]);

    const web_ref = ComponentConfig.getServiceRef('concourse/web/web:latest');
    const worker_ref = ComponentConfig.getServiceRef('concourse/worker/worker:latest');

    expect(graph.nodes.map((n) => n.ref)).has.members([
      'concourse/web:latest-interfaces',
      web_ref,
      worker_ref
    ])
    expect(graph.edges.map((e) => e.toString())).has.members([
      `concourse/web:latest-interfaces [main] -> ${web_ref} [main]`,
      `${worker_ref} [service->main] -> concourse/web:latest-interfaces [main]`
    ])

    const template = await DockerComposeUtils.generate(graph);
    const expected_compose: DockerComposeTemplate = {
      'services': {
        [web_ref]: {
          'environment': {},
          'ports': [
            '50000:8080'
          ],
          'build': {
            'context': path.resolve('/stack')
          }
        },
        [worker_ref]: {
          'environment': {
            'REGULAR': `${web_ref}:2222`,
            'SINGLE_QUOTE': `${web_ref}:2222`,
            'DOUBLE_QUOTE': `${web_ref}:2222`,
          },
          'ports': [],
          'build': {
            'context': path.resolve('/stack')
          },
          'depends_on': [
            web_ref
          ]
        },
      },
      'version': '3',
      'volumes': {},
    };
    if (process.platform === 'linux') {
      expected_compose.services[web_ref].extra_hosts = [
        "host.docker.internal:host-gateway"
      ];
      expected_compose.services[worker_ref].extra_hosts = [
        "host.docker.internal:host-gateway"
      ];
    }
    expect(template).to.be.deep.equal(expected_compose);

    const public_manager = new LocalDependencyManager(axios.create(), {
      'concourse/web': '/stack/web.json',
      'concourse/worker': '/stack/worker.json'
    });
    const public_graph = await public_manager.getGraph([
      await manager.loadComponentConfig('concourse/web', { public: 'main' }),
      await manager.loadComponentConfig('concourse/worker')
    ]);

    expect(public_graph.nodes.map((n) => n.ref)).has.members([
      'gateway',
      'concourse/web:latest-interfaces',
      web_ref,
      worker_ref
    ])
    expect(public_graph.edges.map((e) => e.toString())).has.members([
      `gateway [public] -> concourse/web:latest-interfaces [main]`,
      `concourse/web:latest-interfaces [main] -> ${web_ref} [main]`,
      `${worker_ref} [service->main] -> concourse/web:latest-interfaces [main]`
    ])

    const public_template = await DockerComposeUtils.generate(public_graph);
    const expected_web_compose: DockerService = {
      environment: {},
      "labels": [
        "traefik.enable=true",
        "traefik.http.routers.public.rule=Host(`public.localhost`)",
        "traefik.http.routers.public.service=public-service",
        "traefik.http.services.public-service.loadbalancer.server.port=8080",
        "traefik.http.services.public-service.loadbalancer.server.scheme=http"
      ],
      external_links: [
        'gateway:public.localhost'
      ],
      'ports': [
        '50001:8080'
      ],
      'restart': 'always',
      'build': {
        'context': path.resolve('/stack')
      }
    };
    if (process.platform === 'linux') {
      expected_web_compose.extra_hosts = [
        "host.docker.internal:host-gateway"
      ];
    }
    expect(public_template.services[web_ref]).to.be.deep.equal(expected_web_compose);
    const expected_worker_compose: DockerService = {
      'environment': {
        'REGULAR': `${web_ref}:2222`,
        'SINGLE_QUOTE': `${web_ref}:2222`,
        'DOUBLE_QUOTE': `${web_ref}:2222`,
      },
      'ports': [],
      'build': {
        'context': path.resolve('/stack')
      },
      depends_on: [web_ref],
      external_links: [
        'gateway:public.localhost'
      ],
    };
    if (process.platform === 'linux') {
      expected_worker_compose.extra_hosts = [
        "host.docker.internal:host-gateway"
      ];
    }
    expect(public_template.services[worker_ref]).to.be.deep.equal(expected_worker_compose);
  });

  it('interpolation interfaces', async () => {
    const backend_config = `
    name: examples/backend
    interfaces:
      main: \${{ services.api.interfaces.api.url }}
    services:
      api:
        interfaces:
          api: 8081
        environment:
          INTERNAL_HOST: \${{ services.api.interfaces.api.url }}
          EXTERNAL_HOST: \${{ environment.ingresses['examples/backend']['main'].url }}
    `
    const frontend_config = `
    name: examples/frontend
    interfaces:
      main: \${{ services.app.interfaces.app.url }}
    dependencies:
      examples/backend: latest
    services:
      app:
        interfaces:
          app: 8080
        environment:
          EXTERNAL_API_HOST: \${{ environment.ingresses['examples/backend']['main'].url }}
          INTERNAL_APP_URL: \${{ interfaces.main.url }}
    `

    mock_fs({
      '/backend/architect.yml': backend_config,
      '/frontend/architect.yml': frontend_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/backend': '/backend/architect.yml',
      'examples/frontend': '/frontend/architect.yml'
    });
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('examples/backend', { backend: 'main' }),
      await manager.loadComponentConfig('examples/frontend')
    ]);
    const backend_external_url = 'http://backend.localhost'
    const backend_ref = ComponentConfig.getServiceRef('examples/backend/api:latest');
    const backend_node = graph.getNodeByRef(backend_ref) as ServiceNode;
    expect(backend_node.node_config.getEnvironmentVariables()).to.deep.eq({
      INTERNAL_HOST: `http://${backend_ref}:8081`,
      EXTERNAL_HOST: backend_external_url
    })
    const frontend_ref = ComponentConfig.getServiceRef('examples/frontend/app:latest');
    const frontend_node = graph.getNodeByRef(frontend_ref) as ServiceNode;
    expect(frontend_node.node_config.getEnvironmentVariables()).to.deep.eq({
      EXTERNAL_API_HOST: backend_external_url,
      INTERNAL_APP_URL: `http://${frontend_ref}:8080`,
    })
  });

  it('interpolation environment file:', async () => {
    const component_config = {
      name: 'test/component',
      interfaces: {
        main: '${{ services.web.interfaces.main.url }}'
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

    const properties = 'log_level=${{ parameters.log_level }}'

    mock_fs({
      '/stack/web/application.properties': properties,
      '/stack/web/web.json': JSON.stringify(component_config),
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'test/component': '/stack/web/web.json',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('test/component'),
    ]);
    const web_ref = ComponentConfig.getServiceRef('test/component/web:latest');
    const node = graph.getNodeByRef(web_ref) as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      APPLICATION_PROPERTIES: 'log_level=debug'
    });
  });

  it('service environment param interpolated from component parameter with file ref', async () => {
    const component_config = {
      name: 'test/component',
      interfaces: {
        main: '${{ services.web.interfaces.main.url }}'
      },
      parameters: {
        TEST_FILE_DATA: 'file:./test-file.txt'
      },
      services: {
        web: {
          interfaces: {
            main: 8080
          },
          environment: {
            TEST_DATA: '${{ parameters.TEST_FILE_DATA }}'
          }
        }
      }
    }

    mock_fs({
      '/stack/web/test-file.txt': 'some test file data from component param',
      '/stack/web/web.json': JSON.stringify(component_config),
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'test/component': '/stack/web/web.json',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('test/component'),
    ]);
    const web_ref = ComponentConfig.getServiceRef('test/component/web:latest');
    const node = graph.getNodeByRef(web_ref) as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      TEST_DATA: 'some test file data from component param'
    });
  });

  it('yaml file ref with a mix of numbers and letters', async () => {
    const component_config = `
    name: examples/hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          T3ST_FILE_DATA16: file:./test-file.txt

    interfaces:
      echo:
        url: \${{ services.api.interfaces.main.url }}
    `

    mock_fs({
      '/stack/test-file.txt': 'some file data',
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('examples/hello-world'),
    ]);
    const api_ref = ComponentConfig.getServiceRef('examples/hello-world/api:latest');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      T3ST_FILE_DATA16: 'some file data'
    });
  });

  it('yaml file ref as .env file', async () => {
    const component_config = `
    name: examples/hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          TEST_FILE_DATA: file:.env

    interfaces:
      echo:
        url: \${{ services.api.interfaces.main.url }}
    `

    mock_fs({
      '/stack/.env': 'some file data',
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('examples/hello-world'),
    ]);
    const api_ref = ComponentConfig.getServiceRef('examples/hello-world/api:latest');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      TEST_FILE_DATA: 'some file data'
    });
  });

  it('yaml file ref as .env file via linked component', async () => {
    const component_config = `
    name: examples/hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          TEST_FILE_DATA: file:.env

    interfaces:
      echo:
        url: \${{ services.api.interfaces.main.url }}
    `

    mock_fs({
      '/stack/.env': 'some file data',
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('examples/hello-world'),
    ]);
    const api_ref = ComponentConfig.getServiceRef('examples/hello-world/api:latest');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      TEST_FILE_DATA: 'some file data'
    });
  });

  it('multiple yaml file refs as .env files', async () => {
    const component_config = `
    name: examples/hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          TEST_FILE_DATA: file:.env
          OTHER_TEST_FILE_DATA: file:.env-other

    interfaces:
      echo:
        url: \${{ services.api.interfaces.main.url }}
    `

    mock_fs({
      '/stack/.env': 'some file data',
      '/stack/.env-other': 'some file data from other file',
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('examples/hello-world'),
    ]);
    const api_ref = ComponentConfig.getServiceRef('examples/hello-world/api:latest');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      TEST_FILE_DATA: 'some file data',
      OTHER_TEST_FILE_DATA: 'some file data from other file'
    });
  });

  it('multi-line file inserted into yaml produces proper yaml', async () => {
    const component_config = `
    name: examples/hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          TEST_FILE_DATA: file:.env

    interfaces:
      echo:
        url: \${{ services.api.interfaces.main.url }}
    `

    mock_fs({
      '/stack/.env': 'some file data\nsome file data on a new line\n  file data indented on a new line',
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('examples/hello-world'),
    ]);
    const api_ref = ComponentConfig.getServiceRef('examples/hello-world/api:latest');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      TEST_FILE_DATA: 'some file data\nsome file data on a new line\n  file data indented on a new line',
    });
  });

  it('multi-line file inserted into json produces proper json', async () => {
    const component_config = {
      name: 'test/component',
      interfaces: {
        main: '${{ services.web.interfaces.main.url }}'
      },
      services: {
        web: {
          interfaces: {
            main: 8080
          },
          environment: {
            TEST_DATA: 'file:./test-file.txt'
          }
        }
      }
    }

    mock_fs({
      '/stack/test-file.txt': 'some file data\nsome file data on a new line\n  file data indented on a new line',
      '/stack/web.json': JSON.stringify(component_config),
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'test/component': '/stack/web.json',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('test/component'),
    ]);
    const web_ref = ComponentConfig.getServiceRef('test/component/web:latest');
    const node = graph.getNodeByRef(web_ref) as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      TEST_DATA: 'some file data\nsome file data on a new line\n  file data indented on a new line'
    });
  });

  it('backwards file refs to build stack with yml configs', async () => {
    const component_config = `
    name: examples/hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          TEST_FILE_DATA: file:../.env

    interfaces:
      echo:
        url: \${{ services.api.interfaces.main.url }}
    `

    mock_fs({
      '/stack/.env': 'some file data',
      '/stack/arc/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/arc/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('examples/hello-world'),
    ]);
    const api_ref = ComponentConfig.getServiceRef('examples/hello-world/api:latest');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      TEST_FILE_DATA: 'some file data',
    });
  });

  it('yaml comment not interpreted as active file ref', async () => {
    const component_config = `
    name: examples/hello-world

    parameters:
      TEST_FILE: manually set test file env # file:./this-file-does-not-exist.nope

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          TEST_FILE_ENV: \${{ parameters.TEST_FILE }}

    interfaces:
      echo:
        url: \${{ services.api.interfaces.main.url }}
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('examples/hello-world'),
    ]);
    const api_ref = ComponentConfig.getServiceRef('examples/hello-world/api:latest');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      TEST_FILE_ENV: 'manually set test file env'
    });
  });

  it('file: at end of yaml key not interpreted as file ref', async () => {
    const component_config = `
    name: examples/hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          data_from_my_config_file: regular config file data

    interfaces:
      echo:
        url: \${{ services.api.interfaces.main.url }}
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('examples/hello-world'),
    ]);
    const api_ref = ComponentConfig.getServiceRef('examples/hello-world/api:latest');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      data_from_my_config_file: 'regular config file data'
    });
  });

  it('commented file ref not interpreted to be read', async () => {
    const component_config = `
    name: examples/hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          ENV_PARAM: env_param_data
    #      CONFIG_DATA: file:./this-file-does-not-exist.nope

    interfaces:
      echo:
        url: \${{ services.api.interfaces.main.url }}
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('examples/hello-world'),
    ]);
    const api_ref = ComponentConfig.getServiceRef('examples/hello-world/api:latest');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      ENV_PARAM: 'env_param_data'
    });
  });

  it('file ref with bash env vars', async () => {
    const component_config = `
    name: examples/hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          CONFIG_DATA: file:./application.properties.tpl

    interfaces:
      echo:
        url: \${{ services.api.interfaces.main.url }}
    `

    const properties_tpl = `
    test.security.apiTrustedSecret=\${TEST_AUTH_CODE_SECRET:}
    test.security.apiTrustedSecret2=\${ TEST_AUTH_CODE_SECRET }
    `

    mock_fs({
      '/stack/application.properties.tpl': properties_tpl,
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('examples/hello-world'),
    ]);
    const api_ref = ComponentConfig.getServiceRef('examples/hello-world/api:latest');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      CONFIG_DATA: 'test.security.apiTrustedSecret=$${TEST_AUTH_CODE_SECRET:}\n    test.security.apiTrustedSecret2=$${ TEST_AUTH_CODE_SECRET }'
    });
  });

  it('implicit environment parameter', async () => {
    const component_config = `
    name: examples/hello-world

    parameters:
      aws_secret:
      other_secret:
      default_secret: test3

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          AWS_SECRET: \${{ parameters.aws_secret }}
          OTHER_SECRET: \${{ parameters.other_secret }}
          DEFAULT_SECRET: \${{ parameters.default_secret }}

    interfaces:
      echo:
        url: \${{ services.api.interfaces.main.url }}
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('examples/hello-world'),
    ], {
      '*': { aws_secret: 'test' },
      'examples/hello-world*': { other_secret: 'shown' }
    });
    const api_ref = ComponentConfig.getServiceRef('examples/hello-world/api:latest');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      AWS_SECRET: 'test',
      OTHER_SECRET: 'shown',
      DEFAULT_SECRET: 'test3'
    });
  });
});
