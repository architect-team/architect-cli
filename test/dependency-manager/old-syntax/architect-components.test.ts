import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import path from 'path';
import sinon from 'sinon';
import Build from '../../../src/commands/build';
import LocalDependencyManager from '../../../src/common/dependency-manager/local-manager';
import * as DockerCompose from '../../../src/common/docker-compose';
import PortUtil from '../../../src/common/utils/port';


describe('old architect components', () => {
  beforeEach(() => {
    // Stub the logger
    sinon.replace(Build.prototype, 'log', sinon.stub());
    moxios.install();

    sinon.replace(PortUtil, 'isPortAvailable', async () => true);
    PortUtil.reset();
  });

  afterEach(() => {
    // Restore stubs
    sinon.restore();
    // Restore fs
    mock_fs.restore();
    moxios.uninstall();
  });

  it('old architect components', async () => {
    mock_fs({
      '/docker-registry/architect.json': JSON.stringify(ARC_PROXY_CONFIG),
      '/docker-registry/registry/architect.json': JSON.stringify(ARC_REGISTRY_CONFIG),
      '/cloud-api/architect.json': JSON.stringify(ARC_API_CONFIG),
      '/cloud-api/concourse/web/architect.json': JSON.stringify(CONCOURSE_WEB_CONFIG),
      '/cloud-api/concourse/worker/architect.json': JSON.stringify(CONCOURSE_WORKER_CONFIG),
      '/architect-cloud/architect.json': JSON.stringify(ARC_CLOUD_CONFIG),
      '/stack/arc.env.json': JSON.stringify(ARC_ENV_CONFIG),
      '/stack/secret': '<secret>'
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const graph = await manager.getGraph();
    expect(graph.nodes).length(9);
    expect(graph.edges).length(5);

    const template = await DockerCompose.generate(manager);

    expect(template.services['architect.registry.service.latest']).to.be.deep.equal({
      "ports": [
        "50000:8080"
      ],
      "depends_on": [],
      "environment": {
        "NOTIFICATION_URL": "http://architect.cloud-api.latest:8080",
        "HOST": "architect.registry.service.latest",
        "PORT": "8080"
      },
      "build": {
        "context": path.resolve('/docker-registry/registry')
      }
    });

    expect(template.services['architect.registry-proxy.service.latest']).to.be.deep.equal({
      "ports": [
        "50001:8080"
      ],
      "depends_on": [],
      "environment": {
        "CLOUD_API_BASE_URL": "http://architect.cloud-api.latest:8080",
        "CLOUD_API_SECRET": "test",
        "REGISTRY_TARGET": "http://architect.registry.service.latest:8080",
        "NODE_ENV": "development",
        "HOST": "architect.registry-proxy.service.latest",
        "PORT": "8080"
      },
      "command": [
        "npm",
        "run",
        "start:dev"
      ],
      "build": {
        "context": path.resolve('/docker-registry'),
        "args": [
          "NODE_ENV=development"
        ]
      },
      "volumes": [
        `${path.resolve('/docker-registry/src')}:/usr/src/app/src`
      ]
    });

    expect(template.services['architect.cloud-api.service.latest']).to.be.deep.equal({
      "ports": [
        "50002:8080"
      ],
      "depends_on": [
        "gateway"
      ],
      "environment": {
        "NODE_ENV": "local",
        "CONCOURSE_USERNAME": "test",
        "CONCOURSE_PASSWORD": "test",
        "DB_HOST": "host.docker.internal",
        "DB_PORT": "5432",
        "DB_USER": "postgres",
        "DB_PASS": "architect",
        "DB_NAME": "architect_cloud_api",
        "DEFAULT_INTERNAL_REGISTRY_HOST": "architect.registry-proxy.service.latest:8080",
        "DEFAULT_INSECURE_REGISTRY_HOST": "architect.registry.service.latest:8080",
        "DEFAULT_CONCOURSE_HOST": "http://concourse.web.service.latest:8080",
        "ENABLE_SCHEDULE": "false",
        "SEGMENT_WRITE_KEY": "test",
        "HOST": "architect.cloud-api.service.latest",
        "PORT": "8080",
        "VIRTUAL_HOST": "api.localhost",
        "VIRTUAL_PORT": "50002"
      },
      "command": [
        "npm",
        "run",
        "start:dev"
      ],
      "build": {
        "context": path.resolve('/cloud-api'),
        "args": [
          "NODE_ENV=local"
        ]
      },
      "volumes": [
        `${path.resolve('/cloud-api/src')}:/usr/src/app/src`,
        `${path.resolve('/cloud-api/test')}:/usr/src/app/test`,
      ],
      "restart": "always"
    });

    expect(template.services['gateway']).to.be.deep.equal({
      "image": "registry.architect.io/architect-nginx/proxy:latest",
      "restart": "always",
      "ports": [
        "80:80"
      ],
      "volumes": [
        "/var/run/docker.sock:/tmp/docker.sock:ro"
      ],
      "depends_on": [],
      "environment": {
        "HTTPS_METHOD": "noredirect",
        "DISABLE_ACCESS_LOGS": "true"
      }
    });

    expect(template.services['architect.cloud.service.latest']).to.be.deep.equal({
      "ports": [
        "50003:8080"
      ],
      "depends_on": [
        "gateway"
      ],
      "environment": {
        "ENVIRONMENT": "local",
        "NODE_ENV": "production",
        "SEGMENT_WRITE_KEY": "test",
        "CLOUD_API_BASE_URL": "http://architect.cloud-api.service.latest:8080",
        "HOST": "architect.cloud.service.latest",
        "PORT": "8080",
        "VIRTUAL_HOST": "app.localhost",
        "VIRTUAL_PORT": "50003"
      },
      "command": [
        "npm",
        "run",
        "dev"
      ],
      "build": {
        "context": path.resolve('/architect-cloud'),
        "args": [
          "NODE_ENV=production"
        ]
      },
      "volumes": [
        `${path.resolve('/stack/src')}:/usr/src/app/src`,
      ],
      "restart": "always"
    });

    expect(template.services['concourse.web.service.latest']).to.be.deep.equal({
      "ports": [
        "50004:8080"
      ],
      "depends_on": [
        "gateway"
      ],
      "environment": {
        "CONCOURSE_LOG_LEVEL": "error",
        "CONCOURSE_TSA_LOG_LEVEL": "debug",
        "CONCOURSE_POSTGRES_HOST": "host.docker.internal",
        "CONCOURSE_POSTGRES_USER": "postgres",
        "CONCOURSE_POSTGRES_PASSWORD": "architect",
        "CONCOURSE_POSTGRES_DATABASE": "concourse",
        "CONCOURSE_ADD_LOCAL_USER": "test:test",
        "CONCOURSE_MAIN_TEAM_LOCAL_USER": "test",
        "CONCOURSE_CLUSTER_NAME": "dev",
        "CONCOURSE_VAULT_AUTH_BACKEND": "approle",
        "CONCOURSE_ENABLE_REDACT_SECRETS": "true",
        "CONCOURSE_BUILD_TRACKER_INTERVAL": "1s",
        "CONCOURSE_LIDAR_SCANNER_INTERVAL": "1s",
        "CONCOURSE_LIDAR_CHECKER_INTERVAL": "1s",
        "CONCOURSE_COMPONENT_RUNNER_INTERVAL": "1s",
        "HOST": "concourse.web.service.latest",
        "PORT": "8080",
        "VIRTUAL_HOST": "ci.localhost",
        "VIRTUAL_PORT": "50004"
      },
      "image": "concourse/concourse:6.1.0",
      "command": [
        "web"
      ],
      "volumes": [
        `${path.resolve('/cloud-api/concourse/keys/web')}:/concourse-keys`,
      ],
      "restart": "always"
    });

    expect(template.services['concourse.worker.service.latest']).to.be.deep.equal({
      "privileged": true,
      "stop_signal": "SIGUSR2",
      "ports": [],
      "depends_on": [],
      "environment": {
        "CONCOURSE_LOG_LEVEL": "error",
        "CONCOURSE_BAGGAGECLAIM_LOG_LEVEL": "error",
        "CONCOURSE_GARDEN_LOG_LEVEL": "error",
        "CONCOURSE_TSA_HOST": "concourse.web.service.latest:2222",
        "CONCOURSE_BAGGAGECLAIM_DRIVER": "overlay",
        "CONCOURSE_BIND_IP": "0.0.0.0",
        "CONCOURSE_BAGGAGECLAIM_BIND_IP": "0.0.0.0",
        "HOST": "concourse.worker.service.latest",
        "PORT": undefined
      },
      "image": "concourse/concourse:6.1.0",
      "command": [
        "worker"
      ],
      "volumes": [
        `${path.resolve('/cloud-api/concourse/keys/worker')}:/concourse-keys`,
      ]
    });
  });
});

const ARC_REGISTRY_CONFIG = {
  "name": "architect/registry",
  "description": "Wrapper for the base docker registry image",
  "keywords": [
    "architect",
    "docker",
    "registry"
  ],
  "author": "Architect.io",
  "dependencies": {},
  "datastores": {},
  "language": "node",
  "parameters": {
    "NOTIFICATION_URL": {}
  },
  "interfaces": {
    "main": 8080
  }
}

const ARC_PROXY_CONFIG = {
  "name": "architect/registry-proxy",
  "description": "Docker registry proxy by Architect",
  "keywords": [
    "architect",
    "docker",
    "registry",
    "proxy"
  ],
  "author": "Architect.io",
  "dependencies": {
    "architect/registry": "latest"
  },
  "build": {
    "args": {
      "NODE_ENV": "${ parameters.NODE_ENV }"
    }
  },
  "datastores": {},
  "language": "node",
  "parameters": {
    "CLOUD_API_BASE_URL": {},
    "CLOUD_API_SECRET": {},
    "REGISTRY_TARGET": "http://${ dependencies['architect/registry'].interfaces.main.host }:${ dependencies['architect/registry'].interfaces.main.port }",
    "NODE_ENV": {}
  },
  "debug": {
    "command": "npm run start:dev",
    "volumes": {
      "src": {
        "mount_path": "/usr/src/app/src",
        "host_path": "./src"
      }
    }
  },
  "interfaces": {
    "main": 8080
  }
}

export const ARC_API_CONFIG = {
  "name": "architect/cloud-api",
  "description": "API powering the Architect Hub and related clients and services",
  "keywords": [
    "architect",
    "docker",
    "node"
  ],
  "author": "Architect.io",
  "dependencies": {
    "architect/registry-proxy": "latest",
    "architect/registry": "latest",
    "concourse/web": "latest"
  },
  "language": "node",
  "interfaces": {
    "main": 8080
  },
  "datastores": {
    "primary": {
      "image": "postgres:11",
      "port": 5432,
      "parameters": {
        "POSTGRES_USER": {
          "default": "postgres"
        },
        "POSTGRES_PASSWORD": {
          "default": "architect"
        },
        "POSTGRES_DB": {
          "default": "architect_cloud_api"
        }
      }
    }
  },
  "build": {
    "args": {
      "NODE_ENV": "${ parameters.NODE_ENV }"
    }
  },
  "parameters": {
    "NODE_ENV": {},
    "CONCOURSE_USERNAME": {
      "default": "test"
    },
    "CONCOURSE_PASSWORD": {
      "default": "test"
    },
    "DB_HOST": {
      "default": {
        "valueFrom": {
          "datastore": "primary",
          "value": "$HOST"
        }
      }
    },
    "DB_PORT": {
      "default": {
        "valueFrom": {
          "datastore": "primary",
          "value": "$PORT"
        }
      }
    },
    "DB_USER": {
      "default": {
        "valueFrom": {
          "datastore": "primary",
          "value": "$POSTGRES_USER"
        }
      }
    },
    "DB_PASS": {
      "default": {
        "valueFrom": {
          "datastore": "primary",
          "value": "$POSTGRES_PASSWORD"
        }
      }
    },
    "DB_NAME": {
      "default": {
        "valueFrom": {
          "datastore": "primary",
          "value": "$POSTGRES_DB"
        }
      }
    },
    "DEFAULT_INTERNAL_REGISTRY_HOST": "${ dependencies['architect/registry-proxy'].interfaces.main.host }:${ dependencies['architect/registry-proxy'].interfaces.main.port }",
    "DEFAULT_INSECURE_REGISTRY_HOST": "${ dependencies['architect/registry'].interfaces.main.host }:${ dependencies['architect/registry'].interfaces.main.port }",
    "DEFAULT_CONCOURSE_HOST": "${ dependencies['concourse/web'].interfaces.main.internal.url }",
    "ENABLE_SCHEDULE": {
      "description": "Enable scheduled jobs",
      "default": false
    },
    "SEGMENT_WRITE_KEY": {
      "description": "Write key for source on segment.com",
      "default": ""
    },
  },
  "debug": {
    "command": "npm run start:dev",
    "volumes": {
      "src": {
        "mount_path": "/usr/src/app/src",
        "host_path": "./src"
      },
      "test": {
        "mount_path": "/usr/src/app/test",
        "host_path": "./test"
      }
    }
  }
}

export const CONCOURSE_WEB_CONFIG = {
  "name": "concourse/web",
  "description": "Concourse web",
  "keywords": [
    "concourse",
    "docker",
    "go"
  ],
  "author": "Architect.io",
  "dependencies": {
    "concourse/worker": "latest"
  },
  "language": "go",
  "image": "concourse/concourse:6.1.0",
  "command": "web",
  "datastores": {
    "primary": {
      "image": "postgres:11",
      "port": 5432,
      "parameters": {
        "POSTGRES_USER": {
          "default": "postgres"
        },
        "POSTGRES_PASSWORD": {
          "default": "architect"
        },
        "POSTGRES_DB": {
          "default": "concourse"
        }
      }
    }
  },
  "parameters": {
    "CONCOURSE_LOG_LEVEL": {
      "default": "debug"
    },
    "CONCOURSE_TSA_LOG_LEVEL": {
      "default": "debug"
    },
    "CONCOURSE_POSTGRES_HOST": {
      "default": {
        "valueFrom": {
          "datastore": "primary",
          "value": "$HOST"
        }
      }
    },
    "CONCOURSE_POSTGRES_USER": {
      "default": {
        "valueFrom": {
          "datastore": "primary",
          "value": "$POSTGRES_USER"
        }
      }
    },
    "CONCOURSE_POSTGRES_PASSWORD": {
      "default": {
        "valueFrom": {
          "datastore": "primary",
          "value": "$POSTGRES_PASSWORD"
        }
      }
    },
    "CONCOURSE_POSTGRES_DATABASE": {
      "default": {
        "valueFrom": {
          "datastore": "primary",
          "value": "$POSTGRES_DB"
        }
      }
    },
    "CONCOURSE_ADD_LOCAL_USER": {
      "default": "test:test"
    },
    "CONCOURSE_MAIN_TEAM_LOCAL_USER": {
      "default": "test"
    },
    "CONCOURSE_CLUSTER_NAME": {
      "default": "dev"
    },
    "CONCOURSE_VAULT_AUTH_BACKEND": {
      "default": "approle"
    },
    "CONCOURSE_ENABLE_REDACT_SECRETS": {
      "default": "true"
    },
    "CONCOURSE_BUILD_TRACKER_INTERVAL": {
      "default": "1s"
    },
    "CONCOURSE_LIDAR_SCANNER_INTERVAL": {
      "default": "1s"
    },
    "CONCOURSE_LIDAR_CHECKER_INTERVAL": {
      "default": "1s"
    },
    "CONCOURSE_COMPONENT_RUNNER_INTERVAL": {
      "default": "1s"
    }
  },
  "volumes": {
    "web-keys": {
      "mount_path": "/concourse-keys"
    }
  },
  "interfaces": {
    "main": 8080
  }
}

export const CONCOURSE_WORKER_CONFIG = {
  "name": "concourse/worker",
  "description": "Concourse worker",
  "keywords": [
    "concourse",
    "docker",
    "go"
  ],
  "author": "Architect.io",
  "image": "concourse/concourse:6.1.0",
  "command": "worker",
  "dependencies": {
    "concourse/web": "latest"
  },
  "parameters": {
    "CONCOURSE_LOG_LEVEL": {
      "default": "debug"
    },
    "CONCOURSE_BAGGAGECLAIM_LOG_LEVEL": {
      "default": "debug"
    },
    "CONCOURSE_GARDEN_LOG_LEVEL": {
      "default": "debug"
    },
    "CONCOURSE_TSA_HOST": "${ dependencies['concourse/web'].interfaces.main.internal.host }:2222",
    "CONCOURSE_BAGGAGECLAIM_DRIVER": {
      "default": "overlay"
    },
    "CONCOURSE_BIND_IP": {
      "default": "0.0.0.0"
    },
    "CONCOURSE_BAGGAGECLAIM_BIND_IP": {
      "default": "0.0.0.0"
    }
  },
  "platforms": {
    "docker-compose": {
      "privileged": true,
      "stop_signal": "SIGUSR2"
    }
  },
  "volumes": {
    "worker-keys": {
      "mount_path": "/concourse-keys"
    }
  }
}

const ARC_CLOUD_CONFIG = {
  "name": "architect/cloud",
  "description": "Architect Cloud",
  "keywords": [
    "architect",
    "cloud",
    "ui"
  ],
  "author": "Architect.io",
  "dependencies": {
    "architect/cloud-api": "latest"
  },
  "datastores": {},
  "language": "node",
  "build": {
    "args": {
      "NODE_ENV": "${ parameters.NODE_ENV }"
    }
  },
  "parameters": {
    "ENVIRONMENT": {},
    "NODE_ENV": {
      "default": "production"
    },
    "SEGMENT_WRITE_KEY": {
      "description": "Write key for source on segment.com",
      "default": ""
    },
    "CLOUD_API_BASE_URL": "http://${ dependencies['architect/cloud-api'].interfaces.main.internal.host }:${ dependencies['architect/cloud-api'].interfaces.main.internal.port }"
  },
  "debug": {
    "command": "npm run dev",
    "parameters": {
      "NODE_ENV": "development"
    },
    "volumes": {
      "src": {
        "mount_path": "/usr/src/app/src",
        "host_path": "./src"
      }
    }
  },
  "interfaces": {
    "main": 8080
  }
}

export const ARC_ENV_CONFIG = {
  "services": {
    "architect/registry:latest": {
      "debug": {
        "path": "../docker-registry/registry"
      },
      "parameters": {
        "NOTIFICATION_URL": "http://architect.cloud-api.latest:8080"
      }
    },
    "architect/registry-proxy:latest": {
      "debug": {
        "path": "../docker-registry"
      },
      "parameters": {
        "CLOUD_API_BASE_URL": "http://architect.cloud-api.latest:8080",
        "CLOUD_API_SECRET": "test",
        "NODE_ENV": "development"
      }
    },
    "architect/cloud-api:latest": {
      "debug": {
        "path": "../cloud-api",
        "volumes": {
          "src": "../cloud-api/src",
          "test": "../cloud-api/test"
        }
      },
      "interfaces": {
        "main": {
          "subdomain": "api"
        }
      },
      "parameters": {
        "NODE_ENV": "local",
        "SEGMENT_WRITE_KEY": "test"
      },
      "datastores": {
        "primary": {
          "host": "host.docker.internal",
          "port": 5432
        }
      }
    },
    "architect/cloud:latest": {
      "debug": {
        "path": "../architect-cloud",
        "volumes": {
          "src": "./src"
        }
      },
      "interfaces": {
        "main": {
          "subdomain": "app"
        }
      },
      "parameters": {
        "ENVIRONMENT": "local",
        "SEGMENT_WRITE_KEY": "test"
      }
    },
    "concourse/web:latest": {
      "debug": {
        "path": "../cloud-api/concourse/web"
      },
      "interfaces": {
        "main": {
          "subdomain": "ci"
        }
      },
      "volumes": {
        "web-keys": "../cloud-api/concourse/keys/web"
      },
      "parameters": {
        "CONCOURSE_LOG_LEVEL": "error"
      },
      "datastores": {
        "primary": {
          "host": "host.docker.internal",
          "port": 5432
        }
      }
    },
    "concourse/worker:latest": {
      "debug": {
        "path": "../cloud-api/concourse/worker"
      },
      "volumes": {
        "worker-keys": "../cloud-api/concourse/keys/worker"
      },
      "parameters": {
        "CONCOURSE_LOG_LEVEL": "error",
        "CONCOURSE_BAGGAGECLAIM_LOG_LEVEL": "error",
        "CONCOURSE_GARDEN_LOG_LEVEL": "error"
      }
    }
  },
  "vaults": {
    "local_vault": {
      "host": "http://0.0.0.0",
      "type": "hashicorp-vault",
      "description": "Secret store for local development",
      "role_id": "test",
      "secret_id": "./secret"
    }
  }
};
