import { expect } from '@oclif/test';
import axios from 'axios';
import yaml from 'js-yaml';
import mock_fs from 'mock-fs';
import path from 'path';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../../src/common/docker-compose';
import DockerComposeTemplate, { DockerService } from '../../src/common/docker-compose/template';
import { buildInterfacesRef, resourceRefToNodeRef, ServiceNode } from '../../src/dependency-manager/src';
import IngressEdge from '../../src/dependency-manager/src/graph/edge/ingress';
import ComponentNode from '../../src/dependency-manager/src/graph/node/component';
import { interpolateObjectOrReject } from '../../src/dependency-manager/src/utils/interpolation';

describe('interpolation spec v1', () => {
  it('interpolate array', () => {
    const source = `
    test:
      - 1
      - \${{ parameters.test2 }}`
    const context = {
      parameters: {
        test2: 2
      }
    }
    expect(interpolateObjectOrReject(yaml.load(source), context)).to.deep.eq({ test: [1, 2] })
  })

  it('interpolation null value', async () => {
    const component_config = `
    name: examples/hello-world

    parameters:
      null_required:
      null_not_required:
        required: false
      null_not_required_default:
        required: false
        default: null
      null_default:
        default: null

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          NULL: null
          NULL2: \${{ parameters.null_required }}
          NULL3: \${{ parameters.null_not_required }}
          NULL4: \${{ parameters.null_not_required_default }}
          NULL5: \${{ parameters.null_default }}

    interfaces:
      echo:
        url: "\${{ services.api.interfaces.main.url }}"
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('examples/hello-world'),
    ], { '*': { null_required: null } });
    const api_ref = resourceRefToNodeRef('examples/hello-world.services.api:latest');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.config.environment).to.deep.eq({});
  });

  it('interpolation multiple refs on same line', async () => {
    const component_config = `
    name: examples/hello-world

    parameters:
      first: 1
      second: 2

    services:
      api:
        environment:
          TEST: \${{ parameters.first }} and \${{ parameters.second }}
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('examples/hello-world'),
    ]);
    const api_ref = resourceRefToNodeRef('examples/hello-world.services.api:latest');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.config.environment).to.deep.eq({ TEST: '1 and 2' });
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
      dependencies: {
        'concourse/web': 'latest'
      },
      services: {
        worker: {
          environment: {
            REGULAR: '${{ dependencies.concourse/web.interfaces.main.host }}:2222',
            SINGLE_QUOTE: '${{ dependencies[\'concourse/web\'].interfaces.main.host }}:2222',
            DOUBLE_QUOTE: '${{ dependencies["concourse/web"].interfaces.main.host }}:2222',
          }
        }
      },
      interfaces: {}
    };

    mock_fs({
      '/stack/web.yml': yaml.dump(web_component_config),
      '/stack/worker.yml': yaml.dump(worker_component_config),
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'concourse/web': '/stack/web.yml',
      'concourse/worker': '/stack/worker.yml'
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('concourse/web'),
      await manager.loadComponentSpec('concourse/worker')
    ]);

    const web_interfaces_ref = resourceRefToNodeRef('concourse/web:latest');
    const web_ref = resourceRefToNodeRef('concourse/web.services.web:latest');
    const worker_ref = resourceRefToNodeRef('concourse/worker.services.worker:latest');

    expect(graph.nodes.map((n) => n.ref)).has.members([
      web_interfaces_ref,
      web_ref,
      worker_ref
    ])
    expect(graph.edges.map((e) => e.toString())).has.members([
      `${web_interfaces_ref} [main] -> ${web_ref} [main]`,
      `${worker_ref} [service->main] -> ${web_interfaces_ref} [main]`
    ])

    const web_node = graph.getNodeByRef(web_ref);
    expect(web_node.interfaces).to.deep.equal({
      main: {
        port: 8080
      }
    });
    const worker_node = graph.getNodeByRef(worker_ref);
    expect(worker_node.interfaces).to.deep.equal({});

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
    expect(template).to.be.deep.equal(expected_compose);

    const public_manager = new LocalDependencyManager(axios.create(), {
      'concourse/web': '/stack/web.json',
      'concourse/worker': '/stack/worker.json'
    });
    const public_graph = await public_manager.getGraph([
      await manager.loadComponentSpec('concourse/web', { interfaces: { public: 'main' } }),
      await manager.loadComponentSpec('concourse/worker')
    ]);

    expect(public_graph.nodes.map((n) => n.ref)).has.members([
      'gateway',
      web_interfaces_ref,
      web_ref,
      worker_ref
    ])
    expect(public_graph.edges.map((e) => e.toString())).has.members([
      `gateway [public] -> ${web_interfaces_ref} [main]`,
      `${web_interfaces_ref} [main] -> ${web_ref} [main]`,
      `${worker_ref} [service->main] -> ${web_interfaces_ref} [main]`
    ])

    const public_template = await DockerComposeUtils.generate(public_graph);
    const expected_web_compose: DockerService = {
      environment: {},
      "labels": [
        "traefik.enable=true",
        "traefik.port=81",
        `traefik.http.routers.${web_ref}-main.rule=Host(\`public.arc.localhost\`)`,
        `traefik.http.routers.${web_ref}-main.service=${web_ref}-main-service`,
        `traefik.http.services.${web_ref}-main-service.loadbalancer.server.port=8080`,
      ],
      external_links: [
        'gateway:public.arc.localhost'
      ],
      'ports': [
        '50001:8080'
      ],
      'build': {
        'context': path.resolve('/stack')
      }
    };
    expect(public_template.services[web_ref]).to.be.deep.equal(expected_web_compose);
    const expected_worker_compose: DockerService = {
      'environment': {
        'REGULAR': `${web_ref}:2222`,
        'SINGLE_QUOTE': `${web_ref}:2222`,
        'DOUBLE_QUOTE': `${web_ref}:2222`,
      },
      'build': {
        'context': path.resolve('/stack')
      },
      depends_on: [web_ref],
      external_links: [
        'gateway:public.arc.localhost'
      ],
    };
    expect(public_template.services[worker_ref]).to.be.deep.equal(expected_worker_compose);
  });

  it('ingresses interpolation', async () => {
    const backend_config = `
    name: examples/backend
    interfaces:
      main: \${{ services.api.interfaces.api.url }}
    services:
      api:
        interfaces:
          api: 8081
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
          EXTERNAL_API_HOST: \${{ dependencies['examples/backend'].ingresses['main'].url }}
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
      await manager.loadComponentSpec('examples/backend'),
      await manager.loadComponentSpec('examples/frontend')
    ]);

    const backend_ref = resourceRefToNodeRef('examples/backend.services.api:latest');
    const backend_interface_ref = `${backend_ref}-main`;
    const backend_external_url = `http://main.arc.localhost`
    const frontend_ref = resourceRefToNodeRef('examples/frontend.services.app:latest');
    const frontend_node = graph.getNodeByRef(frontend_ref) as ServiceNode;
    expect(frontend_node.config.environment).to.deep.eq({
      EXTERNAL_API_HOST: backend_external_url,
    })
    const template = await DockerComposeUtils.generate(graph);
    expect(template.services[frontend_ref].environment).to.deep.eq({
      EXTERNAL_API_HOST: backend_external_url,
    })
    expect(template.services[backend_ref].labels).to.deep.eq([
      'traefik.enable=true',
      "traefik.port=80",
      `traefik.http.routers.${backend_interface_ref}.rule=Host(\`main.arc.localhost\`)`,
      `traefik.http.routers.${backend_interface_ref}.service=${backend_interface_ref}-service`,
      `traefik.http.services.${backend_interface_ref}-service.loadbalancer.server.port=8081`,
    ])
  });

  it('ingresses interpolation with no dependency deployed', async () => {
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
          INTERNAL_ADDR: \${{ dependencies['examples/backend'].interfaces['main'].url }}
          EXTERNAL_API_ADDR: \${{ dependencies['examples/backend'].ingresses['main'].url }}
    `

    mock_fs({
      '/frontend/architect.yml': frontend_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/frontend': '/frontend/architect.yml'
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('examples/frontend')
    ], {}, true, false);

    const frontend_ref = resourceRefToNodeRef('examples/frontend.services.app:latest');
    const frontend_node = graph.getNodeByRef(frontend_ref) as ServiceNode;
    const expected = {
      INTERNAL_ADDR: '<error: dependencies.examples/backend.interfaces.main.url>',
      EXTERNAL_API_ADDR: '<error: dependencies.examples/backend.ingresses.main.url>',
    };
    expect(frontend_node.config.environment).to.deep.eq(expected)
    const template = await DockerComposeUtils.generate(graph);
    expect(template.services[frontend_ref].environment).to.deep.eq(expected)
  });

  it('ingresses consumers interpolation', async () => {
    const backend_config = `
    name: examples/backend
    interfaces:
      main: \${{ services.api.interfaces.api.url }}
      main2: \${{ services.api.interfaces.api.url }}
    services:
      api:
        interfaces:
          api: 8081
        environment:
          CORS: \${{ ingresses.main.consumers }}
          CORS2: \${{ ingresses.main2.consumers }}
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
          EXTERNAL_API_ADDR: \${{ dependencies['examples/backend'].ingresses['main'].url }}
          EXTERNAL_API_ADDR2: \${{ dependencies['examples/backend'].ingresses['main2'].url }}
    `
    const frontend_config2 = `
    name: examples/frontend2
    interfaces:
      main:
        ingress:
          subdomain: '@'
        url: \${{ services.app.interfaces.app.url }}
    dependencies:
      examples/backend: latest
    services:
      app:
        interfaces:
          app: 8080
        environment:
          EXTERNAL_ADDR: \${{ ingresses.main.url }}
          EXTERNAL_API_ADDR: \${{ dependencies['examples/backend'].ingresses['main'].url }}
    `
    const frontend_config3 = `
    name: examples/frontend3
    interfaces:
      main:
        ingress:
          subdomain: frontend3
        url: \${{ services.app.interfaces.app.url }}
    dependencies:
      examples/backend: latest
    services:
      app:
        interfaces:
          app:
            protocol: https
            host: app.architect.io
            port: 443
        environment:
          EXTERNAL_ADDR: \${{ ingresses.main.url }}
          EXTERNAL_API_ADDR: \${{ dependencies['examples/backend'].ingresses['main'].url }}
    `

    mock_fs({
      '/backend/architect.yml': backend_config,
      '/frontend/architect.yml': frontend_config,
      '/frontend2/architect.yml': frontend_config2,
      '/frontend3/architect.yml': frontend_config3,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/backend': '/backend/architect.yml',
      'examples/frontend': '/frontend/architect.yml',
      'examples/frontend2': '/frontend2/architect.yml',
      'examples/frontend3': '/frontend3/architect.yml'
    });

    const graph = await manager.getGraph([
      await manager.loadComponentSpec('examples/backend'),
      await manager.loadComponentSpec('examples/frontend', { interfaces: { frontend: 'main' } }),
      await manager.loadComponentSpec('examples/frontend2'),
      await manager.loadComponentSpec('examples/frontend3')
    ]);

    const template = await DockerComposeUtils.generate(graph);
    const backend_ref = resourceRefToNodeRef('examples/backend.services.api:latest');
    expect(template.services[backend_ref].environment).to.deep.eq({
      CORS: JSON.stringify([`http://arc.localhost`, 'http://frontend.arc.localhost', 'http://main.arc.localhost', 'http://main2.arc.localhost', 'https://app.architect.io']),
      CORS2: JSON.stringify(['http://frontend.arc.localhost', 'http://main.arc.localhost', 'http://main2.arc.localhost'])
    })
    expect(template.services[backend_ref].labels).includes(
      `traefik.http.routers.${backend_ref}-main.rule=Host(\`main.arc.localhost\`)`,
      `traefik.http.routers.${backend_ref}-main2.rule=Host(\`main2.arc.localhost\`)`
    )
  });

  it('interpolation interfaces', async () => {
    const backend_config = `
    name: examples/backend
    interfaces:
      main: \${{ services.api.interfaces.api.url }}
      main2: \${{ services.api.interfaces.api.url }}
    services:
      api:
        interfaces:
          api: 8081
        environment:
          SUBDOMAIN: \${{ ingresses.main.subdomain }}
          DNS_ZONE: \${{ ingresses.main.dns_zone }}
          INTERNAL_HOST: \${{ services.api.interfaces.api.url }}
          EXTERNAL_HOST: \${{ ingresses['main'].url }}
          EXTERNAL_HOST2: \${{ ingresses['main2'].url }}
          EXTERNAL_HOST3: \${{ environment.ingresses['examples/backend']['main'].url }}
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
          SUBDOMAIN: \${{ dependencies['examples/backend'].ingresses.main.subdomain }}
          DNS_ZONE: \${{ dependencies['examples/backend'].ingresses.main.dns_zone }}
          EXTERNAL_API_HOST: \${{ dependencies['examples/backend'].ingresses['main'].url }}
          EXTERNAL_API_HOST2: \${{ dependencies['examples/backend'].ingresses['main2'].url }}
          EXTERNAL_API_HOST3: \${{ environment.ingresses['examples/backend']['main'].url }}
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
      await manager.loadComponentSpec('examples/backend', { interfaces: { backend: 'main', backend2: 'main2' } }),
      await manager.loadComponentSpec('examples/frontend')
    ]);
    const backend_external_url = 'http://backend.arc.localhost'
    const backend2_external_url = 'http://backend2.arc.localhost'
    const backend_ref = resourceRefToNodeRef('examples/backend.services.api:latest');
    const backend_node = graph.getNodeByRef(backend_ref) as ServiceNode;
    expect(backend_node.config.environment).to.deep.eq({
      DNS_ZONE: 'arc.localhost',
      SUBDOMAIN: 'backend',
      INTERNAL_HOST: `http://${backend_ref}:8081`,
      EXTERNAL_HOST: backend_external_url,
      EXTERNAL_HOST2: backend2_external_url,
      EXTERNAL_HOST3: backend_external_url
    })
    const frontend_ref = resourceRefToNodeRef('examples/frontend.services.app:latest');
    const frontend_node = graph.getNodeByRef(frontend_ref) as ServiceNode;
    expect(frontend_node.config.environment).to.deep.eq({
      DNS_ZONE: 'arc.localhost',
      SUBDOMAIN: 'backend',
      INTERNAL_APP_URL: `http://${frontend_ref}:8080`,
      EXTERNAL_API_HOST: backend_external_url,
      EXTERNAL_API_HOST2: backend2_external_url,
      EXTERNAL_API_HOST3: backend_external_url
    })
  });

  // it('interpolation environment file:', async () => {
  //   const component_config = {
  //     name: 'test/component',
  //     interfaces: {
  //       main: '${{ services.web.interfaces.main.url }}'
  //     },
  //     parameters: {
  //       log_level: 'debug'
  //     },
  //     services: {
  //       web: {
  //         interfaces: {
  //           main: 8080
  //         },
  //         environment: {
  //           APPLICATION_PROPERTIES: 'file:./application.properties'
  //         }
  //       }
  //     }
  //   }

  //   const properties = 'log_level=${{ parameters.log_level }}'

  //   mock_fs({
  //     '/stack/web/application.properties': properties,
  //     '/stack/web/web.json': JSON.stringify(component_config),
  //   });

  //   const manager = new LocalDependencyManager(axios.create(), {
  //     'test/component': '/stack/web/web.json',
  //   });
  //   const graph = await manager.getGraph([
  //     await manager.loadComponentSpec('test/component'),
  //   ]);
  //   const web_ref = resourceRefToNodeRef('test/component.services.web:latest');
  //   const node = graph.getNodeByRef(web_ref) as ServiceNode;
  //   expect(node.config.environment).to.deep.eq({
  //     APPLICATION_PROPERTIES: 'log_level=debug'
  //   });
  // });

  // it('service environment param interpolated from component parameter with file ref', async () => {
  //   const component_config = {
  //     name: 'test/component',
  //     interfaces: {
  //       main: '${{ services.web.interfaces.main.url }}'
  //     },
  //     parameters: {
  //       TEST_FILE_DATA: 'file:./test-file.txt'
  //     },
  //     services: {
  //       web: {
  //         interfaces: {
  //           main: 8080
  //         },
  //         environment: {
  //           TEST_DATA: '${{ parameters.TEST_FILE_DATA }}'
  //         }
  //       }
  //     }
  //   }

  //   mock_fs({
  //     '/stack/web/test-file.txt': 'some test file data from component param',
  //     '/stack/web/web.json': JSON.stringify(component_config),
  //   });

  //   const manager = new LocalDependencyManager(axios.create(), {
  //     'test/component': '/stack/web/web.json',
  //   });
  //   const graph = await manager.getGraph([
  //     await manager.loadComponentSpec('test/component'),
  //   ]);
  //   const web_ref = resourceRefToNodeRef('test/component.services.web:latest');
  //   const node = graph.getNodeByRef(web_ref) as ServiceNode;
  //   expect(node.config.environment).to.deep.eq({
  //     TEST_DATA: 'some test file data from component param'
  //   });
  // });

  // it('yaml file ref with a mix of numbers and letters', async () => {
  //   const component_config = `
  //   name: examples/hello-world

  //   services:
  //     api:
  //       image: heroku/nodejs-hello-world
  //       interfaces:
  //         main: 3000
  //       environment:
  //         T3ST_FILE_DATA16: file:./test-file.txt

  //   interfaces:
  //     echo:
  //       url: "\${{ services.api.interfaces.main.url }}"
  //   `

  //   mock_fs({
  //     '/stack/test-file.txt': 'some file data',
  //     '/stack/architect.yml': component_config,
  //   });

  //   const manager = new LocalDependencyManager(axios.create(), {
  //     'examples/hello-world': '/stack/architect.yml',
  //   });
  //   const graph = await manager.getGraph([
  //     await manager.loadComponentSpec('examples/hello-world'),
  //   ]);
  //   const api_ref = resourceRefToNodeRef('examples/hello-world.services.api:latest');
  //   const node = graph.getNodeByRef(api_ref) as ServiceNode;
  //   expect(node.config.environment).to.deep.eq({
  //     T3ST_FILE_DATA16: 'some file data'
  //   });
  // });

  // it('yaml file ref as .env file', async () => {
  //   const component_config = `
  //   name: examples/hello-world

  //   services:
  //     api:
  //       image: heroku/nodejs-hello-world
  //       interfaces:
  //         main: 3000
  //       environment:
  //         TEST_FILE_DATA: file:.env

  //   interfaces:
  //     echo:
  //       url: "\${{ services.api.interfaces.main.url }}"
  //   `

  //   mock_fs({
  //     '/stack/.env': 'some file data',
  //     '/stack/architect.yml': component_config,
  //   });

  //   const manager = new LocalDependencyManager(axios.create(), {
  //     'examples/hello-world': '/stack/architect.yml',
  //   });
  //   const graph = await manager.getGraph([
  //     await manager.loadComponentSpec('examples/hello-world'),
  //   ]);
  //   const api_ref = resourceRefToNodeRef('examples/hello-world.services.api:latest');
  //   const node = graph.getNodeByRef(api_ref) as ServiceNode;
  //   expect(node.config.environment).to.deep.eq({
  //     TEST_FILE_DATA: 'some file data'
  //   });
  // });

  // it('yaml file ref as .env file via linked component', async () => {
  //   const component_config = `
  //   name: examples/hello-world

  //   services:
  //     api:
  //       image: heroku/nodejs-hello-world
  //       interfaces:
  //         main: 3000
  //       environment:
  //         TEST_FILE_DATA: file:.env

  //   interfaces:
  //     echo:
  //       url: "\${{ services.api.interfaces.main.url }}"
  //   `

  //   mock_fs({
  //     '/stack/.env': 'some file data',
  //     '/stack/architect.yml': component_config,
  //   });

  //   const manager = new LocalDependencyManager(axios.create(), {
  //     'examples/hello-world': '/stack/architect.yml',
  //   });
  //   const graph = await manager.getGraph([
  //     await manager.loadComponentSpec('examples/hello-world'),
  //   ]);
  //   const api_ref = resourceRefToNodeRef('examples/hello-world.services.api:latest');
  //   const node = graph.getNodeByRef(api_ref) as ServiceNode;
  //   expect(node.config.environment).to.deep.eq({
  //     TEST_FILE_DATA: 'some file data'
  //   });
  // });

  // it('multiple yaml file refs as .env files', async () => {
  //   const component_config = `
  //   name: examples/hello-world

  //   services:
  //     api:
  //       image: heroku/nodejs-hello-world
  //       interfaces:
  //         main: 3000
  //       environment:
  //         TEST_FILE_DATA: file:.env
  //         OTHER_TEST_FILE_DATA: file:.env-other

  //   interfaces:
  //     echo:
  //       url: "\${{ services.api.interfaces.main.url }}"
  //   `

  //   mock_fs({
  //     '/stack/.env': 'some file data',
  //     '/stack/.env-other': 'some file data from other file',
  //     '/stack/architect.yml': component_config,
  //   });

  //   const manager = new LocalDependencyManager(axios.create(), {
  //     'examples/hello-world': '/stack/architect.yml',
  //   });
  //   const graph = await manager.getGraph([
  //     await manager.loadComponentSpec('examples/hello-world'),
  //   ]);
  //   const api_ref = resourceRefToNodeRef('examples/hello-world.services.api:latest');
  //   const node = graph.getNodeByRef(api_ref) as ServiceNode;
  //   expect(node.config.environment).to.deep.eq({
  //     TEST_FILE_DATA: 'some file data',
  //     OTHER_TEST_FILE_DATA: 'some file data from other file'
  //   });
  // });

  // it('multi-line file inserted into yaml produces proper yaml', async () => {
  //   const component_config = `
  //   name: examples/hello-world

  //   services:
  //     api:
  //       image: heroku/nodejs-hello-world
  //       interfaces:
  //         main: 3000
  //       environment:
  //         TEST_FILE_DATA: file:.env

  //   interfaces:
  //     echo:
  //       url: "\${{ services.api.interfaces.main.url }}"
  //   `

  //   mock_fs({
  //     '/stack/.env': 'some file data\nsome file data on a new line\n  file data indented on a new line',
  //     '/stack/architect.yml': component_config,
  //   });

  //   const manager = new LocalDependencyManager(axios.create(), {
  //     'examples/hello-world': '/stack/architect.yml',
  //   });
  //   const graph = await manager.getGraph([
  //     await manager.loadComponentSpec('examples/hello-world'),
  //   ]);
  //   const api_ref = resourceRefToNodeRef('examples/hello-world.services.api:latest');
  //   const node = graph.getNodeByRef(api_ref) as ServiceNode;
  //   expect(node.config.environment).to.deep.eq({
  //     TEST_FILE_DATA: 'some file data\nsome file data on a new line\n  file data indented on a new line',
  //   });
  // });

  // it('multi-line file inserted into json produces proper json', async () => {
  //   const component_config = {
  //     name: 'test/component',
  //     interfaces: {
  //       main: '${{ services.web.interfaces.main.url }}'
  //     },
  //     services: {
  //       web: {
  //         interfaces: {
  //           main: 8080
  //         },
  //         environment: {
  //           TEST_DATA: 'file:./test-file.txt'
  //         }
  //       }
  //     }
  //   }

  //   mock_fs({
  //     '/stack/test-file.txt': 'some file data\nsome file data on a new line\n  file data indented on a new line',
  //     '/stack/web.json': JSON.stringify(component_config),
  //   });

  //   const manager = new LocalDependencyManager(axios.create(), {
  //     'test/component': '/stack/web.json',
  //   });
  //   const graph = await manager.getGraph([
  //     await manager.loadComponentSpec('test/component'),
  //   ]);
  //   const web_ref = resourceRefToNodeRef('test/component.services.web:latest');
  //   const node = graph.getNodeByRef(web_ref) as ServiceNode;
  //   expect(node.config.environment).to.deep.eq({
  //     TEST_DATA: 'some file data\nsome file data on a new line\n  file data indented on a new line'
  //   });
  // });

  // it('backwards file refs to build stack with yml configs', async () => {
  //   const component_config = `
  //   name: examples/hello-world

  //   services:
  //     api:
  //       image: heroku/nodejs-hello-world
  //       interfaces:
  //         main: 3000
  //       environment:
  //         TEST_FILE_DATA: file:../.env

  //   interfaces:
  //     echo:
  //       url: "\${{ services.api.interfaces.main.url }}"
  //   `

  //   mock_fs({
  //     '/stack/.env': 'some file data',
  //     '/stack/arc/architect.yml': component_config,
  //   });

  //   const manager = new LocalDependencyManager(axios.create(), {
  //     'examples/hello-world': '/stack/arc/architect.yml',
  //   });
  //   const graph = await manager.getGraph([
  //     await manager.loadComponentSpec('examples/hello-world'),
  //   ]);
  //   const api_ref = resourceRefToNodeRef('examples/hello-world.services.api:latest');
  //   const node = graph.getNodeByRef(api_ref) as ServiceNode;
  //   expect(node.config.environment).to.deep.eq({
  //     TEST_FILE_DATA: 'some file data',
  //   });
  // });

  // it('yaml comment not interpreted as active file ref', async () => {
  //   const component_config = `
  //   name: examples/hello-world

  //   parameters:
  //     TEST_FILE: manually set test file env # file:./this-file-does-not-exist.nope

  //   services:
  //     api:
  //       image: heroku/nodejs-hello-world
  //       interfaces:
  //         main: 3000
  //       environment:
  //         TEST_FILE_ENV: \${{ parameters.TEST_FILE }}

  //   interfaces:
  //     echo:
  //       url: "\${{ services.api.interfaces.main.url }}"
  //   `

  //   mock_fs({
  //     '/stack/architect.yml': component_config,
  //   });

  //   const manager = new LocalDependencyManager(axios.create(), {
  //     'examples/hello-world': '/stack/architect.yml',
  //   });
  //   const graph = await manager.getGraph([
  //     await manager.loadComponentSpec('examples/hello-world'),
  //   ]);
  //   const api_ref = resourceRefToNodeRef('examples/hello-world.services.api:latest');
  //   const node = graph.getNodeByRef(api_ref) as ServiceNode;
  //   expect(node.config.environment).to.deep.eq({
  //     TEST_FILE_ENV: 'manually set test file env'
  //   });
  // });

  it('parameter value starting with bracket does not produce invalid yaml', async () => {
    const component_config = `
    name: examples/hello-world

    parameters:
      secret:

    services:
      api:
        environment:
          SECRET: \${{ parameters.secret }}
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('examples/hello-world'),
    ], { '*': { secret: '[abc' } });
    const api_ref = resourceRefToNodeRef('examples/hello-world.services.api:latest');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.config.environment).to.deep.eq({
      SECRET: '[abc'
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
        url: "\${{ services.api.interfaces.main.url }}"
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('examples/hello-world'),
    ]);
    const api_ref = resourceRefToNodeRef('examples/hello-world.services.api:latest');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.config.environment).to.deep.eq({
      data_from_my_config_file: 'regular config file data'
    });
  });

  // it('commented file ref not interpreted to be read', async () => {
  //   const component_config = `
  //   name: examples/hello-world

  //   services:
  //     api:
  //       image: heroku/nodejs-hello-world
  //       interfaces:
  //         main: 3000
  //       environment:
  //         ENV_PARAM: env_param_data
  //   #      CONFIG_DATA: file:./this-file-does-not-exist.nope

  //   interfaces:
  //     echo:
  //       url: "\${{ services.api.interfaces.main.url }}"
  //   `

  //   mock_fs({
  //     '/stack/architect.yml': component_config,
  //   });

  //   const manager = new LocalDependencyManager(axios.create(), {
  //     'examples/hello-world': '/stack/architect.yml',
  //   });
  //   const graph = await manager.getGraph([
  //     await manager.loadComponentSpec('examples/hello-world'),
  //   ]);
  //   const api_ref = resourceRefToNodeRef('examples/hello-world.services.api:latest');
  //   const node = graph.getNodeByRef(api_ref) as ServiceNode;
  //   expect(node.config.environment).to.deep.eq({
  //     ENV_PARAM: 'env_param_data'
  //   });
  // });

  // it('file ref with bash env vars', async () => {
  //   const component_config = `
  //   name: examples/hello-world

  //   services:
  //     api:
  //       image: heroku/nodejs-hello-world
  //       interfaces:
  //         main: 3000
  //       environment:
  //         CONFIG_DATA: file:./application.properties.tpl

  //   interfaces:
  //     echo:
  //       url: "\${{ services.api.interfaces.main.url }}"
  //   `

  //   const properties_tpl = `
  //   test.security.apiTrustedSecret=\${TEST_AUTH_CODE_SECRET:}
  //   test.security.apiTrustedSecret2=\${ TEST_AUTH_CODE_SECRET }
  //   `

  //   mock_fs({
  //     '/stack/application.properties.tpl': properties_tpl,
  //     '/stack/architect.yml': component_config,
  //   });

  //   const manager = new LocalDependencyManager(axios.create(), {
  //     'examples/hello-world': '/stack/architect.yml',
  //   });
  //   const graph = await manager.getGraph([
  //     await manager.loadComponentSpec('examples/hello-world'),
  //   ]);
  //   const api_ref = resourceRefToNodeRef('examples/hello-world.services.api:latest');
  //   const node = graph.getNodeByRef(api_ref) as ServiceNode;
  //   expect(node.config.environment).to.deep.eq({
  //     CONFIG_DATA: 'test.security.apiTrustedSecret=$${TEST_AUTH_CODE_SECRET:}\n    test.security.apiTrustedSecret2=$${ TEST_AUTH_CODE_SECRET }'
  //   });
  // });

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
        url: "\${{ services.api.interfaces.main.url }}"
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('examples/hello-world'),
    ], {
      '*': { aws_secret: 'test' },
      'examples/hello-world*': { other_secret: 'shown' }
    });
    const api_ref = resourceRefToNodeRef('examples/hello-world.services.api:latest');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.config.environment).to.deep.eq({
      AWS_SECRET: 'test',
      OTHER_SECRET: 'shown',
      DEFAULT_SECRET: 'test3'
    });
  });

  it('dependency interpolation from values.yml', async () => {
    const component_config = `
    name: examples/hello-world
    dependencies:
      examples/dependency: latest
    interfaces:
      api: \${{ services.api.interfaces.api.url }}
    services:
      api:
        interfaces:
          api: 8080
        environment:
          ADDR: \${{ ingresses.api.url }}
          DEP_ADDR: \${{ dependencies.examples/dependency.ingresses.app.url }}
    `

    const component_config2 = `
    name: examples/dependency
    interfaces:
      app:
        url: \${{ services.app.interfaces.app.url }}
        ingress:
          subdomain: \${{ parameters.test_subdomain }}
    services:
      app:
        interfaces:
          app: 8080
        environment:
          ADDR: \${{ ingresses.app.url }}
          CORS_URLS: \${{ ingresses.app.consumers }}
          DNS_ZONE: \${{ ingresses.app.dns_zone }}
    parameters:
      test_subdomain:
        required: true
    `

    mock_fs({
      '/stack/architect.yml': component_config,
      '/stack2/architect.yml': component_config2,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
      'examples/dependency': '/stack2/architect.yml',
    });
    const graph = await manager.getGraph(
      await manager.loadComponentSpecs('examples/hello-world'), {
      '*': { test_subdomain: 'test-subdomain' },
    });
    const app_ref = resourceRefToNodeRef('examples/dependency.services.app:latest');
    const node = graph.getNodeByRef(app_ref) as ServiceNode;
    expect(node.config.environment).to.deep.eq({
      ADDR: 'http://test-subdomain.arc.localhost',
      CORS_URLS: '["http://api.arc.localhost","http://test-subdomain.arc.localhost"]',
      DNS_ZONE: 'arc.localhost'
    });

    const ingress_edge = graph.edges.find((edge) => edge.to === resourceRefToNodeRef('examples/dependency:latest')) as IngressEdge
    expect(ingress_edge.interface_mappings).to.deep.equal([{ interface_from: 'test-subdomain', interface_to: 'app' }]);
    expect(ingress_edge.consumers_map).keys('app')
  });

  it('interpolate parameter for replicas', async () => {
    const component_config = `
    name: examples/hello-world
    parameters:
      replicas:
    services:
      api:
        replicas: \${{ parameters.replicas }}
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph(
      await manager.loadComponentSpecs('examples/hello-world'), {
      // TODO:269 allow for number types in values.yml?
      // @ts-ignore
      '*': { replicas: 1 },
    });
    const api_ref = resourceRefToNodeRef('examples/hello-world.services.api:latest');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.config.replicas).to.eq(1);
  });

  it('interpolate object parameter for replicas', async () => {
    const component_config = `
    name: examples/hello-world
    parameters:
      api_config:
        default:
          min_replicas: 3
          max_replicas: 5
    services:
      api:
        replicas: \${{ parameters.api_config.min_replicas }}
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph(
      await manager.loadComponentSpecs('examples/hello-world'));
    const api_ref = resourceRefToNodeRef('examples/hello-world.services.api:latest');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.config.replicas).to.eq(3);
  });

  it('interpolate parameter to env with empty string', async () => {
    const component_config = `
    name: examples/hello-world
    parameters:
      secret:
        default: ''
    services:
      api:
        environment:
          SECRET: \${{ parameters.secret }}
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph(
      await manager.loadComponentSpecs('examples/hello-world'));
    const api_ref = resourceRefToNodeRef('examples/hello-world.services.api:latest');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.config.environment).to.deep.eq({
      SECRET: ''
    });

    const template = await DockerComposeUtils.generate(graph);
    expect(template.services[api_ref].environment).to.deep.eq({
      SECRET: ''
    });
  });

  it('interpolate nested parameter', async () => {
    const component_config = `
    name: examples/hello-world
    parameters:
      db_host:
        default: ''
    services:
      api:
        environment:
          DB_ADDR: \${{ parameters.db_host }}:5432
          DB_ADDR2: \${{ parameters.db_host }}:\${{ parameters.db_host }}
          DB_ADDR3: \${{ parameters.db_host }}:\${{ parameters.db_host }}:5432
          DB_ADDR4: \${{ parameters.db_host }}\${{ parameters.db_host }}
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph(
      await manager.loadComponentSpecs('examples/hello-world'));
    const api_ref = resourceRefToNodeRef('examples/hello-world.services.api:latest');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.config.environment).to.deep.eq({
      DB_ADDR: ':5432',
      DB_ADDR2: ':',
      DB_ADDR3: '::5432',
      DB_ADDR4: '',
    });

    const template = await DockerComposeUtils.generate(graph);
    expect(template.services[api_ref].environment).to.deep.eq({
      DB_ADDR: ':5432',
      DB_ADDR2: ':',
      DB_ADDR3: '::5432',
      DB_ADDR4: '',
    });
  });

  it('interpolate interfaces node', async () => {
    const component_config = `
    name: examples/hello-world
    parameters:
      subdomain: test
    interfaces:
      api:
        url: \${{ services.api.interfaces.main.url }}
        ingress:
          subdomain: \${{ parameters.subdomain }}
    services:
      api:
        interfaces:
          main: 8080
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph(await manager.loadComponentSpecs('examples/hello-world'));

    const api_ref = resourceRefToNodeRef('examples/hello-world.services.api:latest');
    const node = graph.getNodeByRef('examples/hello-world:latest') as ComponentNode;
    expect(node.config.interfaces).to.deep.eq({
      api: {
        url: `http://${api_ref}:8080`,
        ingress: {
          subdomain: 'test'
        }
      }
    });
  });

  it('interpolate interfaces ingress whitelist', async () => {
    const component_config = `
    name: examples/hello-world
    parameters:
      ip_whitelist:
        default: [127.0.0.1]
      required_ip_whitelist:
    interfaces:
      api:
        url: \${{ services.api.interfaces.main.url }}
        ingress:
          ip_whitelist: \${{ parameters.ip_whitelist }}
      api2:
        url: \${{ services.api.interfaces.main.url }}
        ingress:
          ip_whitelist: \${{ parameters.required_ip_whitelist }}
    services:
      api:
        interfaces:
          main: 8080
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph(
      await manager.loadComponentSpecs('examples/hello-world'),
      // @ts-ignore
      { '*': { required_ip_whitelist: ['127.0.0.1/32'] } }
    );
    const api_ref = resourceRefToNodeRef('examples/hello-world.services.api:latest');
    const node = graph.getNodeByRef('examples/hello-world:latest') as ComponentNode;
    expect(node.config.interfaces).to.deep.eq({
      api: {
        url: `http://${api_ref}:8080`,
        ingress: {
          ip_whitelist: ['127.0.0.1']
        }
      },
      api2: {
        url: `http://${api_ref}:8080`,
        ingress: {
          ip_whitelist: ['127.0.0.1/32']
        }
      }
    });
  });

  it('interpolate component outputs', async () => {
    const publisher_config = `
    name: examples/publisher
    parameters:
      topic_name: test
    outputs:
      topic1: test
      topic2: \${{ parameters.topic_name }}
      topic3:
        value: test
      topic4:
        value: \${{ parameters.topic_name }}
    `

    const consumer_config = `
    name: examples/consumer
    dependencies:
      examples/publisher: latest
    services:
      api:
        environment:
          TOPIC1: \${{ dependencies.examples/publisher.outputs.topic1 }}
          TOPIC2: \${{ dependencies.examples/publisher.outputs.topic2 }}
          TOPIC3: \${{ dependencies.examples/publisher.outputs.topic3 }}
          TOPIC4: \${{ dependencies.examples/publisher.outputs.topic4 }}
    `

    mock_fs({
      '/stack/publisher/architect.yml': publisher_config,
      '/stack/consumer/architect.yml': consumer_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/publisher': '/stack/publisher/architect.yml',
      'examples/consumer': '/stack/consumer/architect.yml',
    });
    const graph = await manager.getGraph(
      await manager.loadComponentSpecs('examples/consumer'));
    const api_ref = resourceRefToNodeRef('examples/consumer.services.api:latest');
    // Check the interpolated values on the service node resolved correctly
    const service_node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(service_node.config.environment).to.deep.eq({
      TOPIC1: 'test',
      TOPIC2: 'test',
      TOPIC3: 'test',
      TOPIC4: 'test'
    });
    // Check the component interface node has the outputs set on its config
    const config = await manager.loadComponentSpec('examples/publisher');
    const interfaces_ref = buildInterfacesRef(config);
    const interface_node = graph.getNodeByRef(interfaces_ref) as ComponentNode;
    expect(interface_node.config.outputs).to.deep.eq({
      topic1: { value: "test" },
      topic2: { value: "test" },
      topic3: { value: "test", description: undefined, },
      topic4: { value: "test", description: undefined, },
    });
  });

  it('interpolating output dependency creates OutputEdge', async () => {
    const publisher_config = `
    name: examples/publisher
    outputs:
      topic1: test
    `

    const consumer_config = `
    name: examples/consumer
    dependencies:
      examples/publisher: latest
    services:
      api:
        environment:
          TOPIC1: \${{ dependencies.examples/publisher.outputs.topic1 }}
    `

    mock_fs({
      '/stack/publisher/architect.yml': publisher_config,
      '/stack/consumer/architect.yml': consumer_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/publisher': '/stack/publisher/architect.yml',
      'examples/consumer': '/stack/consumer/architect.yml',
    });
    const graph = await manager.getGraph(
      await manager.loadComponentSpecs('examples/consumer')
    );
    expect(graph.edges).to.deep.eq([
      {
        __type: 'output',
        from: 'consumer-api-vv6rqyis',
        to: 'publisher-xmyfv1tj',
        instance_id: 'examples/consumer:latest',
        interface_mappings: [
          {
            interface_from: 'output->topic1',
            interface_to: 'topic1'
          }
        ]
      }
    ]);
  });

  it('interpolating outputs dependency with interfaces creates 2 edges', async () => {
    const publisher_config = `
    name: examples/publisher
    outputs:
      topic1: test
    services:
      publisher-api:
        interfaces:
          main: 8080
    interfaces:
      api:
        url: \${{ services.publisher-api.interfaces.main.url }}
    `

    const consumer_config = `
    name: examples/consumer
    dependencies:
      examples/publisher: latest
    services:
      consumer-api:
        environment:
          API_HOST: \${{ dependencies.examples/publisher.interfaces.api.url }}
          TOPIC1: \${{ dependencies.examples/publisher.outputs.topic1 }}
    `

    mock_fs({
      '/stack/publisher/architect.yml': publisher_config,
      '/stack/consumer/architect.yml': consumer_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/publisher': '/stack/publisher/architect.yml',
      'examples/consumer': '/stack/consumer/architect.yml',
    });
    const graph = await manager.getGraph(
      await manager.loadComponentSpecs('examples/consumer')
    );
    const publisher_component_ref = resourceRefToNodeRef('examples/publisher:latest');
    const publisher_api_ref = resourceRefToNodeRef('examples/publisher.services.publisher-api:latest');
    const consumer_api_ref = resourceRefToNodeRef('examples/consumer.services.consumer-api:latest');
    expect(graph.edges.map((e) => e.toString())).has.members([
      `${publisher_component_ref} [api] -> ${publisher_api_ref} [main]`,
      `${consumer_api_ref} [service->api] -> ${publisher_component_ref} [api]`,
      `${consumer_api_ref} [output->topic1] -> ${publisher_component_ref} [topic1]`
    ])
  });

  it('interpolating service port returns a different value based on context for sidecars', async () => {
    const config = `
    name: examples/test

    parameters:
      api_port: 8080

    interfaces:
      api: \${{ services.api.interfaces.main.url }}

    services:
      app:
        environment:
          API_PORT: \${{ services.api.interfaces.main.port }}
          API_ADDR: \${{ services.api.interfaces.main.url }}
      api:
        interfaces:
          main: \${{ parameters.api_port }}
        environment:
          MY_PORT: \${{ services.api.interfaces.main.port }}
          MY_ADDR: \${{ services.api.interfaces.main.url }}
    `

    const upstream_config = `
    name: examples/upstream

    dependencies:
      examples/test: latest

    services:
      app:
        environment:
          API_PORT: \${{ dependencies.examples/test.interfaces.api.port }}
          API_ADDR: \${{ dependencies.examples/test.interfaces.api.url }}
    `

    mock_fs({
      '/stack/architect.yml': config,
      '/stack/upstream/architect.yml': upstream_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/test': '/stack/architect.yml',
      'examples/upstream': '/stack/upstream/architect.yml'
    });
    manager.use_sidecar = true;
    const graph = await manager.getGraph(
      await manager.loadComponentSpecs('examples/upstream')
    );

    const app_ref = resourceRefToNodeRef('examples/test.services.app:latest');
    const app_node = graph.getNodeByRef(app_ref) as ServiceNode;
    expect(app_node.config.environment).to.deep.eq({
      API_PORT: '12345',
      API_ADDR: 'http://127.0.0.1:12345'
    })

    const api_ref = resourceRefToNodeRef('examples/test.services.api:latest');
    const api_node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(api_node.config.environment).to.deep.eq({
      MY_PORT: '8080',
      MY_ADDR: 'http://127.0.0.1:8080'
    })

    const upstream_ref = resourceRefToNodeRef('examples/upstream.services.app:latest');
    const upstream_node = graph.getNodeByRef(upstream_ref) as ServiceNode;
    expect(upstream_node.config.environment).to.deep.eq({
      API_PORT: '12345',
      API_ADDR: 'http://127.0.0.1:12345'
    })
  });
});
