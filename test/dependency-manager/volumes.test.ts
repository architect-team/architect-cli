import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import path from 'path';
import sinon from 'sinon';
import Build from '../../src/commands/build';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import * as DockerCompose from '../../src/common/docker-compose';

describe('volumes', function () {
  beforeEach(async () => {
    // Stub the logger
    sinon.replace(Build.prototype, 'log', sinon.stub());
  });

  afterEach(function () {
    // Restore stubs
    sinon.restore();
    // Restore fs
    mock_fs.restore();
  });

  it('should mount host path to container path', async () => {
    const service_config = {
      name: "architect/backend",
      dependencies: {
        "architect/backend-db": "latest"
      },
      volumes: {
        env_volume: {
          mount_path: "/usr/src/volume1"
        }
      }
    };

    const service_config2 = {
      name: "architect/backend-db",
      volumes: {
        env_volume: {
          mount_path: "/usr/src/volume1"
        }
      }
    };

    const env_config = {
      services: {
        "architect/backend": {
          debug: {
            path: "./src/backend",
            volumes: {
              env_volume: "/home/testUser/volume1",
              new_volume: {
                mount_path: "/src",
                host_path: "./src",
                readonly: true
              }
            }
          }
        },
        "architect/backend-db": {
          debug: {
            path: "./src/backend-db",
            volumes: {
              new_volume: {
                mount_path: "/src",
                host_path: "./src",
                readonly: true
              }
            }
          }
        },
      }
    };

    mock_fs({
      '/stack/src/backend/architect.json': JSON.stringify(service_config),
      '/stack/src/backend-db/architect.json': JSON.stringify(service_config2),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const compose = await DockerCompose.generate(manager);
    expect(compose.services['architect.backend.service.latest'].volumes).to.include.members([`${path.resolve('/home/testUser/volume1')}:/usr/src/volume1`]);
  });

  it('should mount relative paths correctly', async () => {
    const service_config = {
      name: "architect/backend",
      volumes: {
        env_volume: {
          mount_path: "/usr/src/volume1"
        }
      }
    };

    const env_config = {
      services: {
        "architect/backend:latest": {
          debug: {
            path: "./src/backend",
            volumes: {
              env_volume: "./relative-volume"
            }
          }
        }
      }
    };

    mock_fs({
      '/stack/src/backend/architect.json': JSON.stringify(service_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const compose = await DockerCompose.generate(manager);
    expect(compose.services['architect.backend.service.latest'].volumes).to.include.members([`${path.resolve('/stack/relative-volume')}:/usr/src/volume1`]);
  });

  it('should mount to parameterized container path', async () => {
    const service_config = {
      name: "architect/backend",
      parameters: {
        VOLUME_PATH: {
          default: '/usr/src/volume2'
        }
      },
      volumes: {
        parameter_env_volume: {
          mount_path: "${ parameters.VOLUME_PATH }"
        },
      }
    };

    const env_config = {
      services: {
        "architect/backend:latest": {
          debug: {
            path: "./src/backend",
            volumes: {
              parameter_env_volume: "/home/testUser/volume2"
            }
          },

          parameters: {
            VOLUME_PATH: '/my/custom/path'
          }
        }
      }
    };

    mock_fs({
      '/stack/src/backend/architect.json': JSON.stringify(service_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const compose = await DockerCompose.generate(manager);

    expect(compose.services['architect.backend.service.latest'].volumes).to.include.members([`${path.resolve('/home/testUser/volume2')}:/my/custom/path`]);
  });

  it('should create volume w/out explicit host binding', async () => {
    const service_config = {
      name: "architect/backend",
      volumes: {
        env_volume: {
          mount_path: "/usr/src/no-host-binding"
        }
      }
    };

    const env_config = {
      services: {
        "architect/backend:latest": {
          debug: {
            path: "./src/backend"
          }
        }
      }
    };

    mock_fs({
      '/stack/src/backend/architect.json': JSON.stringify(service_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const compose = await DockerCompose.generate(manager);

    expect(compose.services['architect.backend.service.latest'].volumes).to.include.members(['/usr/src/no-host-binding']);
  });

  it('should support readonly mode', async () => {
    const service_config = {
      name: "architect/backend",
      volumes: {
        env_volume: {
          mount_path: "/usr/src/volume1",
          readonly: true
        }
      }
    };

    const env_config = {
      services: {
        "architect/backend:latest": {
          debug: {
            path: "./src/backend",
            volumes: {
              env_volume: "/home/testUser/volume1"
            }
          }
        }
      }
    };

    mock_fs({
      '/stack/src/backend/architect.json': JSON.stringify(service_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const compose = await DockerCompose.generate(manager);
    expect(compose.services['architect.backend.service.latest'].volumes).to.include.members([`${path.resolve('/home/testUser/volume1/')}:/usr/src/volume1:ro`]);
  });

  it('should override volume locally', async () => {
    const service_config = {
      name: "architect/backend",
      volumes: {
        env_volume: {
          mount_path: "/usr/src/overridden_volume"
        }
      }
    };

    const env_config = {
      services: {
        "architect/backend:latest": {
          debug: {
            path: "./src/backend",
            volumes: {
              env_volume: "/home/testUser/volume1"
            }
          },
          volumes: {
            env_volume: {
              mount_path: "/usr/src/env_volume"
            }
          }
        }
      }
    };

    mock_fs({
      '/stack/src/backend/architect.json': JSON.stringify(service_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const compose = await DockerCompose.generate(manager);
    expect(compose.services['architect.backend.service.latest'].volumes).to.include.members([`${path.resolve('/home/testUser/volume1/')}:/usr/src/env_volume`]);
  });

  it('specify only debug volume', async () => {
    const service_config = {
      name: "architect/backend",
      debug: {
        volumes: {
          src: {
            mount_path: "/src",
            host_path: "./src"
          }
        }
      }
    };

    const env_config = {
      services: {
        "architect/backend:latest": {
          debug: {
            path: "./src/backend",
            volumes: {
              src: "./src"
            }
          }
        }
      }
    };

    mock_fs({
      '/stack/src/backend/architect.json': JSON.stringify(service_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const debug_manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const debug_compose = await DockerCompose.generate(debug_manager);
    expect(debug_compose.services['architect.backend.service.latest'].volumes).to.include.members([`${path.resolve('/stack/src')}:/src`]);
  });

  it('volume relative to service config', async () => {
    const service_config = {
      name: "architect/backend",
      debug: {
        volumes: {
          src: {
            host_path: "./src",
            mount_path: "/usr/src"
          }
        }
      }
    };

    const env_config = {
      services: {
        "architect/backend:latest": {
          debug: {
            path: "./src/backend"
          }
        }
      }
    };

    mock_fs({
      '/stack/src/backend/architect.json': JSON.stringify(service_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const debug_manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const debug_compose = await DockerCompose.generate(debug_manager);
    expect(debug_compose.services['architect.backend.service.latest'].volumes).to.include.members([`${path.resolve('/stack/src/backend/src')}:/usr/src`]);
  });
});
