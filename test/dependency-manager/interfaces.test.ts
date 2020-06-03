import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import sinon from 'sinon';
import Build from '../../src/commands/build';
import LocalDependencyGraph from '../../src/common/dependency-manager/local-graph';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import * as DockerCompose from '../../src/common/docker-compose';
import PortUtil from '../../src/common/utils/port';
import { ServiceNode } from '../../src/dependency-manager/src';

describe('interfaces', function () {

  beforeEach(async () => {
    // Stub the logger
    sinon.replace(Build.prototype, 'log', sinon.stub());

    const checkout_json = {
      "name": "architect/checkout",
      "interfaces": {
        "main": {
          "port": 7000
        }
      }
    };

    const backend_json = {
      "name": "architect/backend",
      "dependencies": {
        "architect/checkout": "latest"
      },
      "interfaces": {
        "main": {
          "description": "main port",
          "port": 8080
        },
        "secondary": {
          "description": "secondary port",
          "port": 8081
        },
        "concise": 8082
      },
      "parameters": {
        "CHECKOUT_ADDR": {
          "valueFrom": {
            "dependency": "architect/checkout",
            "value": "$HOST:$PORT"
          }
        },
        "CHECKOUT_ADDR_DEFAULT": {
          "default": {
            "valueFrom": {
              "dependency": "architect/checkout",
              "interface": "main",
              "value": "$HOST:$PORT"
            }
          }
        },
        "HOST": {
          "default": {
            "valueFrom": {
              "interface": "main",
              "value": "$HOST"
            }
          }
        }
      }
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
      },
      "interfaces": {
        "main": {
          "port": 8082
        },
        "secondary": {
          "port": 8083
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
          },
          "interfaces": {
            "secondary": {
              "subdomain": "secondary"
            }
          }
        },
        "architect/frontend-secondary:latest": {
          "debug": {
            "path": "./src/frontend-secondary",
          }
        },
        "architect/checkout:latest": {
          "debug": {
            "path": "./src/checkout/checkout-architect.json",
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
              "port": 8080
            },
            "secondary": {
              "description": "secondary port",
              "host": "secondary.host",
              "port": 8081
            }
          }
        }
      }
    };

    mock_fs({
      '/stack/src/checkout/checkout-architect.json': JSON.stringify(checkout_json),
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

  it('non-interface valueFrom', async () => {
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.internal.json');
    const compose = await DockerCompose.generate(manager);

    expect(compose.services['architect.backend.latest'].environment!.CHECKOUT_ADDR).eq('architect.checkout.latest:7000');
    expect(compose.services['architect.backend.latest'].environment!.CHECKOUT_ADDR_DEFAULT).eq('architect.checkout.latest:7000');
  });

  it('valueFrom port from service interfaces', async () => {
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.internal.json')
    const graph: LocalDependencyGraph = manager.graph;

    const backend_node = graph.nodes.find(node => node.ref === 'architect/backend:latest') as ServiceNode;
    expect(backend_node.is_local).true;
    expect(backend_node!.node_config.getEnvironmentVariables().MAIN_PORT).eq('8080');
    expect(backend_node!.node_config.getEnvironmentVariables().MAIN_PORT).eq('8080');
    expect(backend_node!.node_config.getEnvironmentVariables().SECONDARY_PORT).eq('8081');
    expect(backend_node!.ports.filter(port_pair => port_pair.toString() === '8080').length).eq(1);
    expect(backend_node!.ports.filter(port_pair => port_pair.toString() === '8081').length).eq(1);
    expect(backend_node!.service_config.getInterfaces().main.port).eq(8080);
    expect(backend_node!.service_config.getInterfaces().secondary.port).eq(8081);

    const frontend_main_node = graph.nodes.find(node => node.ref === 'architect/frontend-main:latest') as ServiceNode;
    expect(frontend_main_node.is_local).true;
    expect(frontend_main_node!.node_config.getEnvironmentVariables().API_ADDR).eq(`${backend_node.normalized_ref}:8080`);

    const frontend_secondary_node = graph.nodes.find(node => node.ref === 'architect/frontend-secondary:latest') as ServiceNode;
    expect(frontend_secondary_node.is_local).true;
    expect(frontend_secondary_node!.node_config.getEnvironmentVariables().API_ADDR).eq(`${backend_node.normalized_ref}:8081`);
  });

  it('valueFrom port from environment interfaces', async () => {
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.external.json')
    const graph: LocalDependencyGraph = manager.graph;

    const backend_node = graph.nodes.find(node => node.ref === 'architect/backend:latest') as ServiceNode;
    expect(backend_node.interfaces!.main.port).eq(8080);
    expect(backend_node.interfaces!.secondary.port).eq(8081);

    const frontend_main_node = graph.nodes.find(node => node.ref === 'architect/frontend-main:latest') as ServiceNode;
    expect(frontend_main_node.is_local).true;
    expect(frontend_main_node!.node_config.getEnvironmentVariables().API_ADDR).eq(`main.host:8080`);

    const frontend_secondary_node = graph.nodes.find(node => node.ref === 'architect/frontend-secondary:latest') as ServiceNode;
    expect(frontend_secondary_node.is_local).true;
    expect(frontend_secondary_node!.node_config.getEnvironmentVariables().API_ADDR).eq(`secondary.host:8081`);
  });

  it('correct compose port mappings', async () => {
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.internal.json');
    const compose = await DockerCompose.generate(manager);
    expect(compose.services['architect.backend.latest'].ports).to.include.members(['50002:8080', '50003:8081', '50004:8082']);
    expect(compose.services['architect.frontend-main.latest'].ports).to.include.members(['50000:8082']);
    expect(compose.services['architect.frontend-secondary.latest'].ports).eql([]);
  });

  it('correct interface environment variables in compose', async () => {
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.internal.json');
    const compose = await DockerCompose.generate(manager);

    expect(compose.services['architect.backend.latest'].environment!.HOST).eq('architect.backend.latest');
    expect(compose.services['architect.backend.latest'].environment!.MAIN_PORT).eq('8080');
    expect(compose.services['architect.backend.latest'].environment!.SECONDARY_PORT).eq('8081');
  });

  it('concise interface port spec', async () => {
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.internal.json');
    const compose = await DockerCompose.generate(manager);

    expect(compose.services['architect.backend.latest'].environment!.HOST).eq('architect.backend.latest');
    expect(compose.services['architect.backend.latest'].environment!.CONCISE_PORT).eq('8082');
  });

  it('external interface host spec', async () => {
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.internal.json');
    const compose = await DockerCompose.generate(manager);

    expect(compose.services['architect.frontend-main.latest'].environment!.SECONDARY_HOST).eq('architect.frontend-main.latest');
    expect(compose.services['architect.frontend-main.latest'].environment!.SECONDARY_EXTERNAL_HOST).eq('secondary.localhost');
  });
});
