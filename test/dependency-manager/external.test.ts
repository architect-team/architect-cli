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

describe('external interfaces', () => {
  beforeEach(() => {
    moxios.install();
    moxios.wait(function () {
      let request = moxios.requests.mostRecent()
      if (request) {
        request.respondWith({
          status: 404,
        })
      }
    })

    sinon.replace(Build.prototype, 'log', sinon.stub());
    sinon.replace(PortUtil, 'isPortAvailable', async () => true);
    PortUtil.reset();
  });

  afterEach(() => {
    sinon.restore();
    mock_fs.restore();
    moxios.uninstall();
  });

  it('simple external', async () => {
    const component_config = {
      name: 'architect/cloud',
      services: {
        app: {
          interfaces: {
            main: 8080
          }
        }
      }
    };

    const env_config = {
      components: {
        'architect/cloud': {
          extends: 'file:.',
          services: {
            app: {
              interfaces: {
                main: {
                  host: 'http://external.locahost',
                  port: 80
                }
              }
            }
          }
        }
      }
    };

    mock_fs({
      '/stack/architect.json': JSON.stringify(component_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const graph = await manager.getGraph();
    expect(graph.nodes).length(1);
    expect(graph.nodes[0].ref).eq('architect/cloud/app:latest')
    expect(graph.edges).length(0);
    const app_node = graph.nodes[0] as ServiceNode;
    expect(app_node.is_external).to.be.true;

    const template = await DockerCompose.generate(manager);
    expect(template).to.be.deep.equal({
      'services': {},
      'version': '3',
      'volumes': {},
    })
  });

  it('service connecting to external', async () => {
    const component_config = {
      name: 'architect/cloud',
      services: {
        app: {
          interfaces: {
            main: 8080
          },
          environment: {
            API_ADDR: '${ services.api.interfaces.main.url }',
            EXTERNAL_API_ADDR: '${ services.api.interfaces.main.external.url }'
          }
        },
        api: {
          interfaces: {
            main: 8080
          }
        }
      }
    };

    const env_config = {
      components: {
        'architect/cloud': {
          extends: 'file:.',
          services: {
            api: {
              interfaces: {
                main: {
                  host: 'external.locahost',
                  port: 80
                }
              }
            }
          }
        }
      }
    };

    mock_fs({
      '/stack/architect.json': JSON.stringify(component_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const graph = await manager.getGraph();
    expect(graph.nodes).length(2);
    expect(graph.nodes[0].ref).eq('architect/cloud/app:latest')
    expect(graph.nodes[0].is_external).to.be.false;
    expect(graph.nodes[1].ref).eq('architect/cloud/api:latest')
    expect(graph.nodes[1].is_external).to.be.true;
    expect(graph.edges).length(1);

    const template = await DockerCompose.generate(manager);
    expect(template).to.be.deep.equal({
      services: {
        'architect.cloud.app.latest': {
          depends_on: [],
          environment: {
            API_ADDR: 'https://external.locahost:80',
            EXTERNAL_API_ADDR: 'https://external.locahost:80',
            HOST: 'architect.cloud.app.latest',
            PORT: '8080'
          },
          ports: [
            '50000:8080'
          ]
        }
      },
      'version': '3',
      'volumes': {},
    })
  });
});
