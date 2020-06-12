import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import sinon from 'sinon';
import Build from '../../../src/commands/build';
import LocalDependencyManager from '../../../src/common/dependency-manager/local-manager';
import * as DockerCompose from '../../../src/common/docker-compose';
import PortUtil from '../../../src/common/utils/port';
import { ServiceNode } from '../../../src/dependency-manager/src';

describe('old interfaces', function () {

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
        }
      },
      "datastores": {
        "primary": {
          "image": "postgres:11",
          "port": 5432
        }
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
        },
        "MAIN_PORT": {
          "default": {
            "valueFrom": {
              "interface": "main",
              "value": "$PORT"
            }
          }
        },
        "SECONDARY_PORT": {
          "default": {
            "valueFrom": {
              "interface": "secondary",
              "value": "$PORT"
            }
          }
        },
        "DB_ADDR": {
          "valueFrom": {
            "datastore": "primary",
            "value": "$URL"
          }
        },
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
        },
        "SECONDARY_HOST": {
          "default": {
            "valueFrom": {
              "interface": "secondary",
              "value": "$HOST"
            }
          }
        },
        "SECONDARY_EXTERNAL_HOST": {
          "default": {
            "valueFrom": {
              "interface": "secondary",
              "value": "$EXTERNAL_HOST"
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
      "interfaces": {},
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
          },
          "datastores": {
            "primary": {
              "host": "db.host",
              "port": 5432
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
    sinon.replace(PortUtil, 'isPortAvailable', async () => true);
    PortUtil.reset();
  });

  it('non-interface valueFrom', async () => {
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.internal.json');
    const compose = await DockerCompose.generate(manager);

    expect(compose.services['architect.backend.service.latest'].environment!.CHECKOUT_ADDR).eq('architect.checkout.service.latest:7000');
    expect(compose.services['architect.backend.service.latest'].environment!.CHECKOUT_ADDR_DEFAULT).eq('architect.checkout.service.latest:7000');
    expect(compose.services['architect.backend.service.latest'].environment!.DB_ADDR).eq('http://architect.backend.datastore-primary.latest:5432');
  });

  it('valueFrom port from service interfaces', async () => {
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.internal.json')
    const graph = await manager.getGraph();

    const backend_node = graph.nodes.find(node => node.ref === 'architect/backend/service:latest') as ServiceNode;
    expect(backend_node.is_local).true;
    expect(backend_node!.node_config.getEnvironmentVariables().MAIN_PORT).eq('8080');
    expect(backend_node!.node_config.getEnvironmentVariables().SECONDARY_PORT).eq('8081');
    expect(backend_node!.ports.filter(port_pair => port_pair.toString() === '8080').length).eq(1);
    expect(backend_node!.ports.filter(port_pair => port_pair.toString() === '8081').length).eq(1);
    expect(backend_node!.service_config.getInterfaces().main.port).eq(8080);
    expect(backend_node!.service_config.getInterfaces().secondary.port).eq(8081);

    const frontend_main_node = graph.nodes.find(node => node.ref === 'architect/frontend-main/service:latest') as ServiceNode;
    expect(frontend_main_node.is_local).true;
    expect(frontend_main_node!.node_config.getEnvironmentVariables().API_ADDR).eq(`${backend_node.normalized_ref}:8080`);

    const frontend_secondary_node = graph.nodes.find(node => node.ref === 'architect/frontend-secondary/service:latest') as ServiceNode;
    expect(frontend_secondary_node.is_local).true;
    expect(frontend_secondary_node!.node_config.getEnvironmentVariables().API_ADDR).eq(`${backend_node.normalized_ref}:8081`);
  });

  it('valueFrom port from environment interfaces', async () => {
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.external.json')
    const graph = await manager.getGraph();

    const backend_node = graph.nodes.find(node => node.ref === 'architect/backend/service:latest') as ServiceNode;
    expect(backend_node.interfaces!.main.port).eq(8080);
    expect(backend_node.interfaces!.secondary.port).eq(8081);

    const frontend_main_node = graph.nodes.find(node => node.ref === 'architect/frontend-main/service:latest') as ServiceNode;
    expect(frontend_main_node.is_local).true;
    expect(frontend_main_node!.node_config.getEnvironmentVariables().API_ADDR).eq(`main.host:8080`);

    const frontend_secondary_node = graph.nodes.find(node => node.ref === 'architect/frontend-secondary/service:latest') as ServiceNode;
    expect(frontend_secondary_node.is_local).true;
    expect(frontend_secondary_node!.node_config.getEnvironmentVariables().API_ADDR).eq(`secondary.host:8081`);
  });

  it('correct compose port mappings', async () => {
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.internal.json');
    const compose = await DockerCompose.generate(manager);
    expect(compose.services['architect.backend.service.latest'].ports).to.include.members(['50003:8080', '50004:8081']);
    expect(compose.services['architect.frontend-main.service.latest'].ports).to.include.members(['50000:8082']);
    expect(compose.services['architect.frontend-secondary.service.latest'].ports).eql([]);
  });

  it('external interface host spec', async () => {
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.internal.json');
    const compose = await DockerCompose.generate(manager);

    expect(compose.services['architect.frontend-main.service.latest'].environment!.SECONDARY_HOST).eq('architect.frontend-main.service.latest');
    expect(compose.services['architect.frontend-main.service.latest'].environment!.SECONDARY_EXTERNAL_HOST).eq('secondary.localhost');
  });
});
