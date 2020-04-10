import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import sinon from 'sinon';
import Build from '../../src/commands/build';
import LocalDependencyGraph from '../../src/common/dependency-manager/local-graph';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { LocalServiceNode } from '../../src/common/dependency-manager/local-service-node';
import * as DockerCompose from '../../src/common/docker-compose';
import PortUtil from '../../src/common/utils/port';
import { ExternalNode } from '../../src/dependency-manager/src/graph/node/external';
import { ValueFromParameter } from '../../src/dependency-manager/src/manager';

describe('interfaces', function () {

  beforeEach(async () => {
    // Stub the logger
    sinon.replace(Build.prototype, 'log', sinon.stub());

    const backend_json = {
      "name": "architect/backend",
      "interfaces": {
        "main": {
          "description": "main port",
          "port": "8080"
        },
        "secondary": {
          "description": "secondary port",
          "port": "8081"
        }
      },
      "port": 8888
    };

    const frontend_main_json = {
      "name": "architect/frontend-main",
      "dependencies": {
        "architect/backend": "latest"
      },
      "parameters": {
        "API_ADDR": {
          "default": {
            "valueFrom": {
              "dependency": "architect/backend",
              "interface": "main",
              "value": "$HOST:$PORT"
            }
          }
        }
      }
    };

    const frontend_secondary_json = {
      "name": "architect/frontend-secondary",
      "dependencies": {
        "architect/backend": "latest"
      },
      "parameters": {
        "API_ADDR": {
          "default": {
            "valueFrom": {
              "dependency": "architect/backend:latest",
              "interface": "secondary",
              "value": "$INTERNAL_HOST:$INTERNAL_PORT"
            }
          }
        }
      }
    };

    const env_config_internal = {
      "services": {
        "architect/frontend-main:latest": {
          "debug": {
            "path": "./src/frontend-main",
          }
        },
        "architect/frontend-secondary:latest": {
          "debug": {
            "path": "./src/frontend-secondary",
          }
        },
        "architect/backend:latest": {
          "debug": {
            "path": "./src/backend",
          }
        }
      }
    };

    const env_config_external = {
      "services": {
        "architect/frontend-main:latest": {
          "debug": {
            "path": "./src/frontend-main",
          }
        },
        "architect/frontend-secondary:latest": {
          "debug": {
            "path": "./src/frontend-secondary",
          }
        },
        "architect/backend:latest": {
          "debug": {
            "path": "./src/backend",
          },
          "interfaces": {
            "main": {
              "description": "main port",
              "host": "main.host",
              "port": "8080"
            },
            "secondary": {
              "description": "secondary port",
              "host": "secondary.host",
              "port": "8081"
            }
          }
        }
      }
    };

    mock_fs({
      '/stack/src/frontend-main/architect.json': JSON.stringify(frontend_main_json),
      '/stack/src/frontend-secondary/architect.json': JSON.stringify(frontend_secondary_json),
      '/stack/src/backend/architect.json': JSON.stringify(backend_json),
      '/stack/arc.env.internal.json': JSON.stringify(env_config_internal),
      '/stack/arc.env.external.json': JSON.stringify(env_config_external),
    });
  });

  afterEach(function () {
    // Restore stubs
    sinon.restore();
    // Restore fs
    mock_fs.restore();
    // reset port range between simulated processes
    PortUtil.reset();
  });

  it('valueFrom port from service interfaces', async () => {
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.internal.json')
    const graph: LocalDependencyGraph = manager.graph;

    const backend_node = graph.nodes.find(node => node.ref === 'architect/backend:latest') as LocalServiceNode;
    expect(backend_node!.parameters.MAIN_PORT).eq('8080');
    expect(backend_node!.parameters.SECONDARY_PORT).eq('8081');
    expect(backend_node!.ports.filter(port_pair => port_pair.target.toString() === '8080').length).eq(1);
    expect(backend_node!.ports.filter(port_pair => port_pair.target.toString() === '8081').length).eq(1);
    expect(backend_node!.service_config.getInterfaces().main.port).eq('8080');
    expect(backend_node!.service_config.getInterfaces().secondary.port).eq('8081');

    const frontend_main_node = graph.nodes.find(node => node.ref === 'architect/frontend-main:latest') as LocalServiceNode;
    const interfaced_main_value_from = frontend_main_node!.service_config.getParameters().API_ADDR.default as ValueFromParameter;
    expect(interfaced_main_value_from.valueFrom.interface).eq('main');
    expect(frontend_main_node!.parameters.API_ADDR).eq(`${backend_node.normalized_ref}:8080`);

    const frontend_secondary_node = graph.nodes.find(node => node.ref === 'architect/frontend-secondary:latest') as LocalServiceNode;
    const interfaced_secondary_value_from = frontend_secondary_node!.service_config.getParameters().API_ADDR.default as ValueFromParameter;
    expect(interfaced_secondary_value_from.valueFrom.interface).eq('secondary');
    expect(frontend_secondary_node!.parameters.API_ADDR).eq(`${backend_node.normalized_ref}:8081`);
  });

  it('valueFrom port from environment interfaces', async () => {
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.external.json')
    const graph: LocalDependencyGraph = manager.graph;

    const backend_node = graph.nodes.find(node => node.ref === 'architect/backend:latest') as ExternalNode;
    expect(backend_node.interfaces!.main.port).eq('8080');
    expect(backend_node.interfaces!.secondary.port).eq('8081');

    const frontend_main_node = graph.nodes.find(node => node.ref === 'architect/frontend-main:latest') as LocalServiceNode;
    const interfaced_main_value_from = frontend_main_node!.service_config.getParameters().API_ADDR.default as ValueFromParameter;
    expect(interfaced_main_value_from.valueFrom.interface).eq('main');
    expect(frontend_main_node!.parameters.API_ADDR).eq(`main.host:8080`);

    const frontend_secondary_node = graph.nodes.find(node => node.ref === 'architect/frontend-secondary:latest') as LocalServiceNode;
    const interfaced_secondary_value_from = frontend_secondary_node!.service_config.getParameters().API_ADDR.default as ValueFromParameter;
    expect(interfaced_secondary_value_from.valueFrom.interface).eq('secondary');
    expect(frontend_secondary_node!.parameters.API_ADDR).eq(`secondary.host:8081`);
  });

  it('correct compose port mappings', async () => {
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.internal.json');
    const compose = DockerCompose.generate(manager);

    expect(compose.services['architect.backend.latest'].ports).to.include.members(['50001:8080', '50002:8081']);
    expect(compose.services['architect.frontend-main.latest'].ports).to.include.members(['50000:8080']);
    expect(compose.services['architect.frontend-secondary.latest'].ports).to.include.members(['50003:8080']);
  });

  it('correct interface environment variables in compose', async () => {
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.internal.json');
    const compose = DockerCompose.generate(manager);

    expect(compose.services['architect.backend.latest'].environment!.HOST).eq('architect.backend.latest');
    expect(compose.services['architect.backend.latest'].environment!.MAIN_PORT).eq('8080');
    expect(compose.services['architect.backend.latest'].environment!.SECONDARY_PORT).eq('8081');
  });
});
