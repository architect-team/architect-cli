import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Register from '../../../src/commands/register';
import LocalDependencyManager from '../../../src/common/dependency-manager/local-manager';
import * as DockerCompose from '../../../src/common/docker-compose';
import PortUtil from '../../../src/common/utils/port';
import { Refs, ServiceNode } from '../../../src/dependency-manager/src';

describe('old interfaces', function () {

  beforeEach(async () => {
    // Stub the logger
    sinon.replace(Register.prototype, 'log', sinon.stub());
    moxios.install();
    moxios.wait(function () {
      let request = moxios.requests.mostRecent()
      if (request) {
        request.respondWith({
          status: 404,
        })
      }
    });

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
        "API_URL": {
          "default": {
            "valueFrom": {
              "dependency": "architect/backend",
              "interface": "main",
              "value": "$URL"
            }
          }
        },
        "SECONDARY_HOST": {
          "default": {
            "valueFrom": {
              "interface": "secondary_internal",
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
        },
        "secondary_internal": 8083
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

    const checkout_config = {
      name: 'architect/checkout',
      interfaces: {
        main: 8080
      }
    }

    moxios.stubRequest(`/accounts/architect/components/checkout/versions/latest`, {
      status: 200,
      response: { tag: 'latest', config: checkout_config, service: { url: 'architect/checkout:latest' } }
    });
  });

  afterEach(function () {
    sinon.restore();
    mock_fs.restore();
    moxios.uninstall();
    // reset port range between simulated processes
    sinon.replace(PortUtil, 'isPortAvailable', async () => true);
    PortUtil.reset();
  });

  it('can use valueFrom to reference services without specifying an interface', async () => {
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.internal.json');
    const compose = await DockerCompose.generate(manager);

    const backend_service_ref = Refs.url_safe_ref('architect/backend/service:latest', DockerCompose.MAX_DOCKER_COMPOSE_SVC_NAME);
    const checkout_service_ref = Refs.url_safe_ref('architect/checkout/service:latest', DockerCompose.MAX_DOCKER_COMPOSE_SVC_NAME);
    const backend_datastore_ref = Refs.url_safe_ref('architect/backend/datastore-primary:latest', DockerCompose.MAX_DOCKER_COMPOSE_SVC_NAME);

    expect(compose.services[backend_service_ref].environment!.CHECKOUT_ADDR).eq(`${checkout_service_ref}:7000`);
    expect(compose.services[backend_service_ref].environment!.CHECKOUT_ADDR_DEFAULT).eq(`${checkout_service_ref}:7000`);
    expect(compose.services[backend_service_ref].environment!.DB_ADDR).eq(`http://${backend_datastore_ref}:5432`);
  });

  it('can use valueFrom to reference service\'s own interfaces', async () => {
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.internal.json')
    const graph = await manager.getGraph();

    const backend_node = graph.nodes.find(node => node.ref === 'architect/backend/service:latest') as ServiceNode;
    expect(backend_node.is_local).true;
    expect(backend_node!.node_config.getEnvironmentVariables().MAIN_PORT).eq('8080');
    expect(backend_node!.node_config.getEnvironmentVariables().SECONDARY_PORT).eq('8081');
    expect(backend_node!.ports.filter(port_pair => port_pair.toString() === '8080').length).eq(1);
    expect(backend_node!.ports.filter(port_pair => port_pair.toString() === '8081').length).eq(1);
    expect(backend_node!.node_config.getInterfaces().main.port).eq('8080');
    expect(backend_node!.node_config.getInterfaces().secondary.port).eq('8081');

    const frontend_main_node = graph.getNodeByRef('architect/frontend-main/service:latest') as ServiceNode;
    expect(frontend_main_node.is_local).true;
    const url_safe_ref = Refs.url_safe_ref(backend_node.ref, Refs.MAX_SUBDOMAIN_LENGTH);
    expect(frontend_main_node!.node_config.getEnvironmentVariables().API_ADDR).eq(`${url_safe_ref}:8080`);

    const frontend_secondary_node = graph.getNodeByRef('architect/frontend-secondary/service:latest') as ServiceNode;
    expect(frontend_secondary_node.is_local).true;
    expect(frontend_secondary_node!.node_config.getEnvironmentVariables().API_ADDR).eq(`${url_safe_ref}:8081`);
  });

  it('can use valueFrom to reference dependency interfaces', async () => {
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.external.json')
    const graph = await manager.getGraph();

    const backend_node = graph.getNodeByRef('architect/backend/service:latest') as ServiceNode;
    expect(backend_node.interfaces.main.port).eq('8080');
    expect(backend_node.interfaces.secondary.port).eq('8081');

    const frontend_main_node = graph.getNodeByRef('architect/frontend-main/service:latest') as ServiceNode;
    expect(frontend_main_node.is_local).true;
    expect(frontend_main_node!.node_config.getEnvironmentVariables().API_ADDR).eq(`main.host:8080`);
    expect(frontend_main_node!.node_config.getEnvironmentVariables().API_URL).eq(`https://main.host:8080`);

    const frontend_secondary_node = graph.getNodeByRef('architect/frontend-secondary/service:latest') as ServiceNode;
    expect(frontend_secondary_node.is_local).true;
    expect(frontend_secondary_node!.node_config.getEnvironmentVariables().API_ADDR).eq(`secondary.host:8081`);
  });

  it('generates correct compose port mappings for service interfaces', async () => {
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.internal.json');
    const compose = await DockerCompose.generate(manager);

    const backend_service_ref = Refs.url_safe_ref('architect/backend/service:latest', DockerCompose.MAX_DOCKER_COMPOSE_SVC_NAME);
    const frontend_main_service_ref = Refs.url_safe_ref('architect/frontend-main/service:latest', DockerCompose.MAX_DOCKER_COMPOSE_SVC_NAME);
    const frontend_secondary_service_ref = Refs.url_safe_ref('architect/frontend-secondary/service:latest', DockerCompose.MAX_DOCKER_COMPOSE_SVC_NAME);

    expect(compose.services[backend_service_ref].ports).to.include.members(['50003:8080', '50004:8081']);
    expect(compose.services[frontend_main_service_ref].ports).to.include.members(['50000:8082']);
    expect(compose.services[frontend_secondary_service_ref].ports).eql([]);
  });

  it('properly sets external host address for exposed service interfaces', async () => {
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.internal.json');
    const compose = await DockerCompose.generate(manager);

    const frontend_main_service_ref = Refs.url_safe_ref('architect/frontend-main/service:latest', DockerCompose.MAX_DOCKER_COMPOSE_SVC_NAME);

    expect(compose.services[frontend_main_service_ref].environment!.SECONDARY_HOST).eq(frontend_main_service_ref);
    expect(compose.services[frontend_main_service_ref].environment!.SECONDARY_EXTERNAL_HOST).eq('secondary.localhost');
  });
});
