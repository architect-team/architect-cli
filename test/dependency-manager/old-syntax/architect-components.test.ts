import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Build from '../../../src/commands/build';
import LocalDependencyManager from '../../../src/common/dependency-manager/local-manager';
import * as DockerCompose from '../../../src/common/docker-compose';
import PortUtil from '../../../src/common/utils/port';

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
    "REGISTRY_TARGET": "http://${ dependencies['architect/registry'].services.service.interfaces.main.host }:${ dependencies['architect/registry'].services.service.interfaces.main.port }",
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
    "DEFAULT_REGISTRY_HOST": {
      "description": "Public hostname used to resolve the registry from deployment environments"
    },
    "OAUTH_DOMAIN": {
      "description": "Domain hosting the oauth server for user authentication"
    },
    "OAUTH_AUDIENCE": {
      "description": "Audience used to validate the oauth requests"
    },
    "OAUTH_CLIENT_ID": {
      "description": "Client id used for the management api"
    },
    "OAUTH_CLIENT_SECRET": {
      "description": "Client secret used for the management api"
    },
    "OAUTH_EXTENSION_URL": {
      "description": "Url for the group extension"
    },
    "DEFAULT_REGISTRY_SECRET": {
      "description": "Secret used for registry validation"
    },
    "DEFAULT_AGENT_SECRET": {
      "description": "Secret used for agent validation"
    },
    "GOOGLE_APPLICATION_CREDENTIALS": {
      "description": "File path of the JSON file that contains your google service account key",
      "default": "/root/credentials.json"
    },
    "GOOGLE_APPLICATION_CREDENTIALS_JSON": {
      "description": "Temp fix until volumes are implemented"
    },
    "GOOGLE_STORAGE_BUCKET": {},
    "PUSHER_APP_ID": {
      "description": "App Id"
    },
    "PUSHER_KEY": {
      "description": "Channel key"
    },
    "PUSHER_SECRET_KEY": {
      "description": "Channel secret key"
    },
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
    "DEFAULT_INTERNAL_REGISTRY_HOST": "${ dependencies['architect/registry-proxy'].services.service.interfaces.main.host }:${ dependencies['architect/registry-proxy'].services.service.interfaces.main.port }",
    "DEFAULT_INSECURE_REGISTRY_HOST": "${ dependencies['architect/registry'].services.service.interfaces.main.host }:${ dependencies['architect/registry'].services.service.interfaces.main.port }",
    "DEFAULT_CONCOURSE_HOST": "${ dependencies['concourse/web'].services.service.interfaces.main.internal.url }",
    "ENABLE_SCHEDULE": {
      "description": "Enable scheduled jobs",
      "default": false
    },
    "SLACK_SIGNUP_WEBHOOK": {
      "description": "slack webhook for signup notifications",
      "required": false
    },
    "CLOUD_HOST": {
      "description": "host of the corresponding cloud app (ie https://app.architect.io)",
      "required": true
    },
    "SENDGRID_API_KEY": {
      "description": "API key for accessing SendGrid",
      "required": true
    }
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
    "CONCOURSE_EXTERNAL_URL": {},
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
    "CONCOURSE_VAULT_URL": {},
    "CONCOURSE_VAULT_AUTH_BACKEND_MAX_TTL": {},
    "CONCOURSE_VAULT_AUTH_PARAM": {},
    "CONCOURSE_VAULT_INSECURE_SKIP_VERIFY": {},
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
    "CONCOURSE_TSA_HOST": "${ dependencies['concourse/web'].services.service.interfaces.main.internal.host }:2222",
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
    "AUTH0_CLIENT_ID": {
      "description": "Client ID referencing an Auth0 application",
      "required": false
    },
    "ENVIRONMENT": {},
    "NODE_ENV": {
      "default": "production"
    },
    "SEGMENT_WRITE_KEY": {
      "description": "Write key for source on segment.com",
      "default": ""
    },
    "PUSHER_KEY": {
      "description": "Channel key"
    },
    "CLOUD_API_BASE_URL": "http://${ dependencies['architect/cloud-api'].services.service.interfaces.main.internal.host }:${ dependencies['architect/cloud-api'].services.service.interfaces.main.internal.port }"
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

describe('old architect components', () => {
  beforeEach(() => {
    // Stub the logger
    sinon.replace(Build.prototype, 'log', sinon.stub());
    moxios.install();
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
    expect(template).to.be.deep.equal({
      "version": "3",
      "services": {
        "architect.registry.service.latest": {
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
            "context": "."
          }
        },
        "architect.registry-proxy.service.latest": {
          "ports": [
            "50001:8080"
          ],
          "depends_on": [],
          "environment": {
            "CLOUD_API_BASE_URL": "http://architect.cloud-api.latest:8080",
            "CLOUD_API_SECRET": "",
            "REGISTRY_TARGET": "<TODO>",
            "NODE_ENV": "",
            "HOST": "architect.registry-proxy.service.latest",
            "PORT": "8080"
          },
          "command": [
            "npm",
            "run",
            "start:dev"
          ],
          "build": {
            "context": ".",
            "args": [
              "NODE_ENV=development"
            ]
          },
          "volumes": [
            "C:\\docker-registry\\src:/usr/src/app/src"
          ]
        },
        "architect.cloud-api.service.latest": {
          "ports": [
            "50002:8080"
          ],
          "depends_on": [
            "gateway"
          ],
          "environment": {
            "NODE_ENV": "",
            "DEFAULT_REGISTRY_HOST": "<TODO>",
            "OAUTH_DOMAIN": "<TODO>",
            "OAUTH_AUDIENCE": "<TODO>",
            "OAUTH_CLIENT_ID": "<TODO>",
            "OAUTH_CLIENT_SECRET": "<TODO>",
            "OAUTH_EXTENSION_URL": "<TODO>",
            "DEFAULT_REGISTRY_SECRET": "<TODO>",
            "DEFAULT_AGENT_SECRET": "<TODO>",
            "GOOGLE_APPLICATION_CREDENTIALS": "/root/credentials.json",
            "GOOGLE_APPLICATION_CREDENTIALS_JSON": "<TODO>",
            "GOOGLE_STORAGE_BUCKET": "<TODO>",
            "PUSHER_APP_ID": "<TODO>",
            "PUSHER_KEY": "<TODO>",
            "PUSHER_SECRET_KEY": "<TODO>",
            "CONCOURSE_USERNAME": "test",
            "CONCOURSE_PASSWORD": "test",
            "DB_HOST": "host.docker.internal",
            "DB_PORT": "5432",
            "DB_USER": "<TODO>",
            "DB_PASS": "<TODO>",
            "DB_NAME": "<TODO>",
            "DEFAULT_INTERNAL_REGISTRY_HOST": "<TODO>",
            "DEFAULT_INSECURE_REGISTRY_HOST": "<TODO>",
            "DEFAULT_CONCOURSE_HOST": "<TODO>",
            "ENABLE_SCHEDULE": "false",
            "SLACK_SIGNUP_WEBHOOK": "<TODO>",
            "CLOUD_HOST": "<TODO>",
            "SENDGRID_API_KEY": "<TODO>",
            "SEGMENT_WRITE_KEY": "",
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
            "context": ".",
            "args": [
              "NODE_ENV=local"
            ]
          },
          "volumes": [
            "C:\\cloud-api\\src:/usr/src/app/src",
            "C:\\cloud-api\\test:/usr/src/app/test"
          ],
          "restart": "always"
        },
        "gateway": {
          "image": "registry.architect.io/architect-nginx/proxy:latest",
          "restart": "always",
          "ports": [
            "81:80"
          ],
          "volumes": [
            "/var/run/docker.sock:/tmp/docker.sock:ro"
          ],
          "depends_on": [],
          "environment": {
            "HTTPS_METHOD": "noredirect",
            "DISABLE_ACCESS_LOGS": "true"
          }
        },
        "architect.cloud.service.latest": {
          "ports": [
            "50003:8080"
          ],
          "depends_on": [
            "gateway"
          ],
          "environment": {
            "AUTH0_CLIENT_ID": "<TODO>",
            "ENVIRONMENT": "",
            "NODE_ENV": "production",
            "SEGMENT_WRITE_KEY": "",
            "PUSHER_KEY": "<TODO>",
            "CLOUD_API_BASE_URL": "<TODO>",
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
            "context": ".",
            "args": [
              "NODE_ENV=production"
            ]
          },
          "volumes": [
            "C:\\stack\\src:/usr/src/app/src"
          ],
          "restart": "always"
        },
        "concourse.web.service.latest": {
          "ports": [
            "50004:8080"
          ],
          "depends_on": [
            "gateway"
          ],
          "environment": {
            "CONCOURSE_LOG_LEVEL": "",
            "CONCOURSE_TSA_LOG_LEVEL": "debug",
            "CONCOURSE_POSTGRES_HOST": "host.docker.internal",
            "CONCOURSE_POSTGRES_USER": "<TODO>",
            "CONCOURSE_POSTGRES_PASSWORD": "<TODO>",
            "CONCOURSE_POSTGRES_DATABASE": "<TODO>",
            "CONCOURSE_EXTERNAL_URL": "<TODO>",
            "CONCOURSE_ADD_LOCAL_USER": "test:test",
            "CONCOURSE_MAIN_TEAM_LOCAL_USER": "test",
            "CONCOURSE_CLUSTER_NAME": "dev",
            "CONCOURSE_VAULT_AUTH_BACKEND": "approle",
            "CONCOURSE_VAULT_URL": "<TODO>",
            "CONCOURSE_VAULT_AUTH_BACKEND_MAX_TTL": "<TODO>",
            "CONCOURSE_VAULT_AUTH_PARAM": "<TODO>",
            "CONCOURSE_VAULT_INSECURE_SKIP_VERIFY": "<TODO>",
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
            "C:\\cloud-api\\concourse\\keys\\web:/concourse-keys"
          ],
          "restart": "always"
        },
        "concourse.worker.service.latest": {
          "privileged": true,
          "stop_signal": "SIGUSR2",
          "ports": [],
          "depends_on": [],
          "environment": {
            "CONCOURSE_LOG_LEVEL": "",
            "CONCOURSE_BAGGAGECLAIM_LOG_LEVEL": "",
            "CONCOURSE_GARDEN_LOG_LEVEL": "",
            "CONCOURSE_TSA_HOST": "<TODO>:2222",
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
            "C:\\cloud-api\\concourse\\keys\\worker:/concourse-keys"
          ]
        }
      },
      "volumes": {}
    })
  });
});
