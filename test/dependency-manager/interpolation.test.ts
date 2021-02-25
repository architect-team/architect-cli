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
        public: '${{ components.concourse/web:latest.interfaces.main.url }}'
      }
    }

    mock_fs({
      '/stack/web.json': JSON.stringify(web_component_config),
      '/stack/worker.json': JSON.stringify(worker_component_config),
      '/stack/environment.json': JSON.stringify(env_config),
      '/stack/public.environment.json': JSON.stringify(public_env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.json');
    const graph = await manager.getGraph();
    expect(graph.nodes.map((n) => n.ref)).has.members([
      'concourse/web:latest-interfaces',
      'concourse/web/web:latest',
      'concourse/worker/worker:latest'
    ])
    expect(graph.edges.map((e) => e.toString())).has.members([
      'concourse/web:latest-interfaces [main] -> concourse/web/web:latest [main]'
    ])

    const template = await DockerComposeUtils.generate(manager);
    const url_safe_ref = Refs.url_safe_ref('concourse/web/web:latest');
    const expected_compose: DockerComposeTemplate = {
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
    };
    if (process.platform === 'linux') {
      expected_compose.services['concourse--web--web--latest--62arnmmt'].extra_hosts = [
        "host.docker.internal:host-gateway"
      ];
      expected_compose.services['concourse--worker--worker--latest--umjxggst'].extra_hosts = [
        "host.docker.internal:host-gateway"
      ];
    }
    expect(template).to.be.deep.equal(expected_compose);

    const public_manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/public.environment.json');
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

    const public_template = await DockerComposeUtils.generate(public_manager);
    const expected_web_compose: DockerService = {
      'depends_on': ['gateway'],
      'environment': {
        'VIRTUAL_HOST': 'public.localhost',
        'VIRTUAL_PORT': '8080',
        VIRTUAL_PORT_public_localhost: '8080',
        'VIRTUAL_PROTO': 'http'
      },
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
    expect(public_template.services['concourse--web--web--latest--62arnmmt']).to.be.deep.equal(expected_web_compose);
    const expected_worker_compose: DockerService = {
      'depends_on': [],
      'environment': {
        'REGULAR': 'concourse--web--web--latest--62arnmmt:2222',
        'SINGLE_QUOTE': 'concourse--web--web--latest--62arnmmt:2222',
        'DOUBLE_QUOTE': 'concourse--web--web--latest--62arnmmt:2222',
      },
      'ports': [],
      'build': {
        'context': path.resolve('/stack')
      },
      external_links: [
        'gateway:public.localhost'
      ],
    };
    if (process.platform === 'linux') {
      expected_worker_compose.extra_hosts = [
        "host.docker.internal:host-gateway"
      ];
    }
    expect(public_template.services['concourse--worker--worker--latest--umjxggst']).to.be.deep.equal(expected_worker_compose);
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
    const env_config = `
    interfaces:
      backend: \${{ components.examples/backend.interfaces.main.url }}
    components:
      examples/backend: file:./backend/architect.yml
      examples/frontend:
        extends: file:./frontend/architect.yml
    `

    mock_fs({
      '/backend/architect.yml': backend_config,
      '/frontend/architect.yml': frontend_config,
      '/environment.yml': env_config
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/environment.yml');
    const graph = await manager.getGraph();
    const backend_external_url = 'http://backend.localhost:80'
    const backend_ref = 'examples/backend/api:latest';
    const backend_node = graph.getNodeByRef(backend_ref) as ServiceNode;
    expect(backend_node.node_config.getEnvironmentVariables()).to.deep.eq({
      INTERNAL_HOST: `http://${Refs.url_safe_ref(backend_ref)}:8081`,
      EXTERNAL_HOST: backend_external_url
    })
    const frontend_ref = 'examples/frontend/app:latest';
    const frontend_node = graph.getNodeByRef(frontend_ref) as ServiceNode;
    expect(frontend_node.node_config.getEnvironmentVariables()).to.deep.eq({
      EXTERNAL_API_HOST: backend_external_url,
      INTERNAL_APP_URL: `http://${Refs.url_safe_ref('examples/frontend/app:latest')}:8080`,
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

    const env_config = {
      components: {
        'test/component:latest': {
          extends: 'file:./web/web.json'
        }
      }
    };

    const properties = 'log_level=${{ parameters.log_level }}'

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

    const env_config = {
      components: {
        'test/component:latest': {
          extends: 'file:./web/web.json'
        }
      }
    };

    mock_fs({
      '/stack/web/test-file.txt': 'some test file data from component param',
      '/stack/web/web.json': JSON.stringify(component_config),
      '/stack/environment.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.json');
    const graph = await manager.getGraph();
    const node = graph.getNodeByRef('test/component/web:latest') as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      TEST_DATA: 'some test file data from component param'
    });
  });

  it('service environment param interpolated from environment parameter with file ref', async () => {
    const component_config = {
      name: 'test/component',
      interfaces: {
        main: '${{ services.web.interfaces.main.url }}'
      },
      parameters: {
        FILE_PARAM: null
      },
      services: {
        web: {
          interfaces: {
            main: 8080
          },
          environment: {
            TEST_DATA: '${{ parameters.FILE_PARAM }}'
          }
        }
      }
    }

    const env_config = {
      parameters: {
        'FILE_PARAM': 'file:./test-file.txt'
      },
      components: {
        'test/component:latest': {
          extends: 'file:./web/web.json',
          parameters: {
            'FILE_PARAM': '${{ parameters.FILE_PARAM }}'
          }
        }
      }
    };

    mock_fs({
      '/stack/test-file.txt': 'some test file data from environment param',
      '/stack/web/web.json': JSON.stringify(component_config),
      '/stack/environment.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.json');
    const graph = await manager.getGraph();
    const node = graph.getNodeByRef('test/component/web:latest') as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      TEST_DATA: 'some test file data from environment param'
    });
  });

  it('json file ref as .env file', async () => {
    const component_config = {
      name: 'test/component',
      interfaces: {
        main: '${{ services.web.interfaces.main.url }}'
      },
      parameters: {
        FILE_PARAM: null
      },
      services: {
        web: {
          interfaces: {
            main: 8080
          },
          environment: {
            TEST_DATA: '${{ parameters.FILE_PARAM }}'
          }
        }
      }
    }

    const env_config = {
      parameters: {
        'FILE_PARAM': 'file:.env'
      },
      components: {
        'test/component:latest': {
          extends: 'file:./web/web.json',
          parameters: {
            'FILE_PARAM': '${{ parameters.FILE_PARAM }}'
          }
        }
      }
    };

    mock_fs({
      '/stack/.env': 'some test file data from environment param',
      '/stack/web/web.json': JSON.stringify(component_config),
      '/stack/environment.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.json');
    const graph = await manager.getGraph();
    const node = graph.getNodeByRef('test/component/web:latest') as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      TEST_DATA: 'some test file data from environment param'
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

    const env_config = `
    interfaces:
      app: \${{ components['examples/hello-world'].interfaces.echo.url }}

    components:
      examples/hello-world:
        extends: file:./architect.yml
    `

    mock_fs({
      '/stack/test-file.txt': 'some file data',
      '/stack/architect.yml': component_config,
      '/stack/environment.yml': env_config,
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.yml');
    const graph = await manager.getGraph();
    const node = graph.getNodeByRef('examples/hello-world/api:latest') as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      T3ST_FILE_DATA16: 'some file data'
    });
  });

  it('yaml file ref in env config', async () => {
    const component_config = `
    name: examples/hello-world

    parameters:
      TEST_FILE_DATA:

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          TEST_FILE_DATA: \${{ parameters.TEST_FILE_DATA }}

    interfaces:
      echo:
        url: \${{ services.api.interfaces.main.url }}
    `

    const env_config = `
    interfaces:
      app: \${{ components['examples/hello-world'].interfaces.echo.url }}

    components:
      examples/hello-world:
        extends: file:./architect.yml
        parameters:
          TEST_FILE_DATA: file:./test-file.txt
    `

    mock_fs({
      '/stack/test-file.txt': 'some file data',
      '/stack/architect.yml': component_config,
      '/stack/environment.yml': env_config,
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.yml');
    const graph = await manager.getGraph();
    const node = graph.getNodeByRef('examples/hello-world/api:latest') as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      TEST_FILE_DATA: 'some file data'
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

    const env_config = `
    interfaces:
      app: \${{ components['examples/hello-world'].interfaces.echo.url }}

    components:
      examples/hello-world:
        extends: file:./architect.yml
    `

    mock_fs({
      '/stack/.env': 'some file data',
      '/stack/architect.yml': component_config,
      '/stack/environment.yml': env_config,
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.yml');
    const graph = await manager.getGraph();
    const node = graph.getNodeByRef('examples/hello-world/api:latest') as ServiceNode;
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

    const env_config = `
    interfaces:
      app: \${{ components['examples/hello-world'].interfaces.echo.url }}

    components:
      examples/hello-world: latest
    `

    mock_fs({
      '/stack/.env': 'some file data',
      '/stack/architect.yml': component_config,
      '/stack/environment.yml': env_config,
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.yml', {}, { 'examples/hello-world': '/stack/architect.yml' });
    const graph = await manager.getGraph();
    const node = graph.getNodeByRef('examples/hello-world/api:latest') as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      TEST_FILE_DATA: 'some file data'
    });
  });

  it('yaml file ref as .env file in environment.yml', async () => {
    const component_config = `
    name: examples/hello-world

    parameters:
      test_file_data: file:.env.default

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          TEST_FILE_DATA: \${{ parameters.test_file_data }}

    interfaces:
      echo:
        url: \${{ services.api.interfaces.main.url }}
    `

    const env_config = `
    interfaces:
      app: \${{ components['examples/hello-world'].interfaces.echo.url }}

    components:
      examples/hello-world:
        extends: file:../data/architect.yml
        parameters:
          test_file_data: file:.env
    `

    mock_fs({
      '/data/.env.default': 'some default file data',
      '/data/architect.yml': component_config,
      '/stack/.env': 'some file data',
      '/stack/environment.yml': env_config,
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.yml');
    const graph = await manager.getGraph();
    const node = graph.getNodeByRef('examples/hello-world/api:latest') as ServiceNode;
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

    const env_config = `
    interfaces:
      app: \${{ components['examples/hello-world'].interfaces.echo.url }}

    components:
      examples/hello-world:
        extends: file:./architect.yml
    `

    mock_fs({
      '/stack/.env': 'some file data',
      '/stack/.env-other': 'some file data from other file',
      '/stack/architect.yml': component_config,
      '/stack/environment.yml': env_config,
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.yml');
    const graph = await manager.getGraph();
    const node = graph.getNodeByRef('examples/hello-world/api:latest') as ServiceNode;
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

    const env_config = `
    interfaces:
      app: \${{ components['examples/hello-world'].interfaces.echo.url }}

    components:
      examples/hello-world:
        extends: file:./architect.yml
    `

    mock_fs({
      '/stack/.env': 'some file data\nsome file data on a new line\n  file data indented on a new line',
      '/stack/architect.yml': component_config,
      '/stack/environment.yml': env_config,
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.yml');
    const graph = await manager.getGraph();
    const node = graph.getNodeByRef('examples/hello-world/api:latest') as ServiceNode;
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
      parameters: {
        FILE_PARAM: null
      },
      services: {
        web: {
          interfaces: {
            main: 8080
          },
          environment: {
            TEST_DATA: '${{ parameters.FILE_PARAM }}'
          }
        }
      }
    }

    const env_config = {
      components: {
        'test/component:latest': {
          extends: 'file:./web.json',
          parameters: {
            'FILE_PARAM': 'file:./test-file.txt'
          }
        }
      }
    };

    mock_fs({
      '/stack/test-file.txt': 'some file data\nsome file data on a new line\n  file data indented on a new line',
      '/stack/web.json': JSON.stringify(component_config),
      '/stack/environment.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.json');
    const graph = await manager.getGraph();
    const node = graph.getNodeByRef('test/component/web:latest') as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      TEST_DATA: 'some file data\nsome file data on a new line\n  file data indented on a new line'
    });
  });

  it('service environment param interpolated directly with file ref', async () => {
    const component_config = {
      name: 'test/component',
      interfaces: {
        main: '${{ services.web.interfaces.main.url }}'
      },
      parameters: {
        FILE_PARAM: null
      },
      services: {
        web: {
          interfaces: {
            main: 8080
          },
          environment: {
            TEST_DATA: '${{ parameters.FILE_PARAM }}'
          }
        }
      }
    }

    const env_config = {
      components: {
        'test/component:latest': {
          extends: 'file:./web.json',
          parameters: {
            'FILE_PARAM': 'file:./test/test-file.txt'
          }
        }
      }
    };

    mock_fs({
      '/stack/test/test-file.txt': 'some test file data from component param',
      '/stack/web.json': JSON.stringify(component_config),
      '/stack/environment.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.json');
    const graph = await manager.getGraph();
    const node = graph.getNodeByRef('test/component/web:latest') as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      TEST_DATA: 'some test file data from component param'
    });
  });

  it('backwards file refs to build stack with json configs', async () => {
    const component_config = {
      name: 'test/component',
      interfaces: {
        main: '${{ services.web.interfaces.main.url }}'
      },
      parameters: {
        FILE_PARAM: null
      },
      services: {
        web: {
          interfaces: {
            main: 8080
          },
          environment: {
            TEST_DATA: '${{ parameters.FILE_PARAM }}'
          }
        }
      }
    }

    const env_config = {
      components: {
        'test/component:latest': {
          extends: 'file:./../test/folder/web.json',
          parameters: {
            'FILE_PARAM': 'file:./../test/test-file.txt'
          }
        }
      }
    };

    mock_fs({
      '/stack/test/test-file.txt': 'some test file data from component param',
      '/stack/test/folder/web.json': JSON.stringify(component_config),
      '/stack/env/environment.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/env/environment.json');
    const graph = await manager.getGraph();
    const node = graph.getNodeByRef('test/component/web:latest') as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      TEST_DATA: 'some test file data from component param'
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

    const env_config = `
    interfaces:
      app: \${{ components['examples/hello-world'].interfaces.echo.url }}

    components:
      examples/hello-world:
        extends: file:./../arc/architect.yml
    `

    mock_fs({
      '/stack/.env': 'some file data',
      '/stack/arc/architect.yml': component_config,
      '/stack/env/environment.yml': env_config,
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/env/environment.yml');
    const graph = await manager.getGraph();
    const node = graph.getNodeByRef('examples/hello-world/api:latest') as ServiceNode;
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

    const env_config = `
    interfaces:
      app: \${{ components['examples/hello-world'].interfaces.echo.url }}

    components:
      examples/hello-world:
        extends: file:./architect.yml
    `

    mock_fs({
      '/stack/architect.yml': component_config,
      '/stack/environment.yml': env_config,
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.yml');
    const graph = await manager.getGraph();
    const node = graph.getNodeByRef('examples/hello-world/api:latest') as ServiceNode;
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

    const env_config = `
    interfaces:
      app: \${{ components['examples/hello-world'].interfaces.echo.url }}

    components:
      examples/hello-world:
        extends: file:./architect.yml
    `

    mock_fs({
      '/stack/architect.yml': component_config,
      '/stack/environment.yml': env_config,
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.yml');
    const graph = await manager.getGraph();
    const node = graph.getNodeByRef('examples/hello-world/api:latest') as ServiceNode;
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

    const env_config = `
    interfaces:
      app: \${{ components['examples/hello-world'].interfaces.echo.url }}

    components:
      examples/hello-world:
        extends: file:./architect.yml
    `

    mock_fs({
      '/stack/architect.yml': component_config,
      '/stack/environment.yml': env_config,
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.yml');
    const graph = await manager.getGraph();
    const node = graph.getNodeByRef('examples/hello-world/api:latest') as ServiceNode;
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

    const env_config = `
    interfaces:
      app: \${{ components['examples/hello-world'].interfaces.echo.url }}

    components:
      examples/hello-world:
        extends: file:./architect.yml
    `

    const properties_tpl = `
    test.security.apiTrustedSecret=\${TEST_AUTH_CODE_SECRET:}
    test.security.apiTrustedSecret2=\${ TEST_AUTH_CODE_SECRET }
    `

    mock_fs({
      '/stack/application.properties.tpl': properties_tpl,
      '/stack/architect.yml': component_config,
      '/stack/environment.yml': env_config,
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.yml');
    const graph = await manager.getGraph(true);
    const node = graph.getNodeByRef('examples/hello-world/api:latest') as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      CONFIG_DATA: 'test.security.apiTrustedSecret=$${TEST_AUTH_CODE_SECRET:}\n    test.security.apiTrustedSecret2=$${ TEST_AUTH_CODE_SECRET }'
    });
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
            AUTH0_SECRET_ID: '${{ parameters.auth0_secret_id }}',
            JSON: '${{ parameters.json }}',
            SINGLE_QUOTE: '${{ parameters.single_quote }}',
            DOUBLE_QUOTE: '${{ parameters.double_quote }}',
          }
        }
      },
      interfaces: {},
    };

    const env_config = {
      parameters: {
        cloud_auth0_secret_id: '${{ vaults.local_vault.secrets/keys#auth0_secret_id }}',
      },
      components: {
        'architect/cloud': {
          extends: 'file:.',
          parameters: {
            auth0_secret_id: '${{ parameters.cloud_auth0_secret_id }}',
            single_quote: "${{ vaults.local_vault['secrets/keys#single_quote'] }}",
            double_quote: '${{ vaults.local_vault["secrets/keys#double_quote"] }}',
            json: '${{ vaults.local_vault.secrets/keys#json }}',
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
      '/stack/environment.json': JSON.stringify(env_config),
      '/stack/secrets/vault-secret': '<secret_id>'
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.json');
    const graph = await manager.getGraph();
    expect(graph.nodes.map((n) => n.ref)).has.members([
      'architect/cloud/app:latest',
    ])
    expect(graph.edges.map((e) => e.toString())).has.members([])
    const app_node = graph.getNodeByRef('architect/cloud/app:latest') as ServiceNode;
    expect(app_node.node_config.getEnvironmentVariables()['AUTH0_SECRET_ID']).eq('worked')

    const template = await DockerComposeUtils.generate(manager);
    const expected_compose: DockerComposeTemplate = {
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
    };
    if (process.platform === 'linux') {
      expected_compose.services['architect--cloud--app--latest--kavtrukr'].extra_hosts = [
        "host.docker.internal:host-gateway"
      ];
    }
    expect(template).to.be.deep.equal(expected_compose);
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

    const env_config = `
    parameters:
      aws_secret: test
      other_secret: not-shown
    components:
      examples/hello-world:
        extends: file:../data/architect.yml
        parameters:
          other_secret: shown
    `

    mock_fs({
      '/data/architect.yml': component_config,
      '/stack/environment.yml': env_config,
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.yml');
    const graph = await manager.getGraph(true);
    const node = graph.getNodeByRef('examples/hello-world/api:latest') as ServiceNode;
    expect(node.node_config.getEnvironmentVariables()).to.deep.eq({
      AWS_SECRET: 'test',
      OTHER_SECRET: 'shown',
      DEFAULT_SECRET: 'test3'
    });
  });

  describe('deploy modules interpolation', () => {
    it('architect context validation is ignored for local', async () => {
      const component_config = `
      name: examples/hello-world

      services:
        api:
          image: heroku/nodejs-hello-world
          interfaces:
          deploy:
            strategy: aws
            modules:
              aws:
                path: ./example
                inputs:
                  environment_name: \${{ architect.environment.name }}
                  vpc_id: \${{ architect.vpc.id }}

      interfaces:
      `

      const env_config = `
      components:
        examples/hello-world: file:../data/architect.yml
      `

      mock_fs({
        '/data/architect.yml': component_config,
        '/stack/environment.yml': env_config,
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.yml');

      sinon.replace(LocalDependencyManager.prototype, 'getArchitectContext', async () => ({ vpc: { id: 'test' } }));

      const graph = await manager.getGraph(true)
      const node = graph.getNodeByRef('examples/hello-world/api:latest') as ServiceNode;
      expect(node.node_config.getDeploy()!.modules.aws.inputs).to.deep.eq({
        environment_name: '',
        vpc_id: 'test',
      });
    });
  });
});
