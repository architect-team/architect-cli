import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import path from 'path';
import sinon from 'sinon';
import Register from '../../src/commands/register';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../../src/common/docker-compose';
import DockerComposeTemplate from '../../src/common/docker-compose/template';
import PortUtil from '../../src/common/utils/port';
import { ServiceNode } from '../../src/dependency-manager/src';

describe('external interfaces spec v1', () => {
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

    sinon.replace(Register.prototype, 'log', sinon.stub());
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
      },
      interfaces: {}
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
      '/stack/environment.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.json');
    const graph = await manager.getGraph();
    expect(graph.nodes.map((n) => n.ref)).has.members([
      'architect/cloud/app:latest',
    ])
    expect(graph.edges.map((e) => e.toString())).has.members([])
    const app_node = graph.getNodeByRef('architect/cloud/app:latest') as ServiceNode;
    expect(app_node.is_external).to.be.true;

    const template = await DockerComposeUtils.generate(manager);
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
            API_ADDR: '${{ services.api.interfaces.main.url }}',
            EXTERNAL_API_ADDR: '${{ services.api.interfaces.main.url }}'
          }
        },
        api: {
          interfaces: {
            main: 8080
          }
        }
      },
      interfaces: {}
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
      '/stack/environment.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/environment.json');
    const graph = await manager.getGraph();
    expect(graph.nodes.map((n) => n.ref)).has.members([
      'architect/cloud/app:latest',
      'architect/cloud/api:latest'
    ])
    expect(graph.edges.map((e) => e.toString())).has.members([
      'architect/cloud/app:latest [service->main] -> architect/cloud/api:latest [main]'
    ])
    const app_node = graph.getNodeByRef('architect/cloud/app:latest') as ServiceNode;
    expect(app_node.is_external).to.be.false;
    const api_node = graph.getNodeByRef('architect/cloud/api:latest') as ServiceNode;
    expect(api_node.is_external).to.be.true;

    const template = await DockerComposeUtils.generate(manager);
    const expected_compose: DockerComposeTemplate = {
      services: {
        'architect--cloud--app--latest--kavtrukr': {
          environment: {
            API_ADDR: 'https://external.locahost:80',
            EXTERNAL_API_ADDR: 'https://external.locahost:80'
          },
          ports: [
            '50000:8080'
          ],
          build: {
            context: path.resolve('/stack')
          }
        }
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
});
