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
      volumes: {
        env_volume: {
          mountPath: "/usr/src/volume1"
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
    const compose = DockerCompose.generate(manager);
    expect(compose.services['architect.backend.latest'].volumes).to.include.members([`${path.resolve('/home/testUser/volume1')}:/usr/src/volume1`]);
  });

  it('should mount relative paths correctly', async () => {
    const service_config = {
      name: "architect/backend",
      volumes: {
        env_volume: {
          mountPath: "/usr/src/volume1"
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
    const compose = DockerCompose.generate(manager);
    expect(compose.services['architect.backend.latest'].volumes).to.include.members([`${path.resolve('/stack/relative-volume')}:/usr/src/volume1`]);
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
          mountPath: "$VOLUME_PATH"
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
    const compose = DockerCompose.generate(manager);

    expect(compose.services['architect.backend.latest'].volumes).to.include.members([`${path.resolve('/home/testUser/volume2')}:/my/custom/path`]);
  });

  it('should create volume w/out explicit host binding', async () => {
    const service_config = {
      name: "architect/backend",
      volumes: {
        env_volume: {
          mountPath: "/usr/src/no-host-binding"
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
    const compose = DockerCompose.generate(manager);

    expect(compose.services['architect.backend.latest'].volumes).to.include.members([`${path.resolve('/usr/src/no-host-binding')}`]);
  });

  it('should support readonly mode', async () => {
    const service_config = {
      name: "architect/backend",
      volumes: {
        env_volume: {
          mountPath: "/usr/src/volume1",
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
    const compose = DockerCompose.generate(manager);
    expect(compose.services['architect.backend.latest'].volumes).to.include.members([`${path.resolve('/home/testUser/volume1/')}:/usr/src/volume1:ro`]);
  });

  it('should override volume locally', async () => {
    const service_config = {
      name: "architect/backend",
      volumes: {
        env_volume: {
          mountPath: "/usr/src/overridden_volume"
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
              mountPath: "/usr/src/env_volume"
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
    const compose = DockerCompose.generate(manager);
    expect(compose.services['architect.backend.latest'].volumes).to.include.members([`${path.resolve('/home/testUser/volume1/')}:/usr/src/env_volume`]);
  });
});
