import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import sinon from 'sinon';
import Build from '../../src/commands/build';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import * as DockerCompose from '../../src/common/docker-compose';
import DockerComposeTemplate from '../../src/common/docker-compose/template';

describe('volumes', function () {
  let compose: DockerComposeTemplate;

  beforeEach(async () => {
    // Stub the logger
    sinon.replace(Build.prototype, 'log', sinon.stub());

    const backend_json = {
      "name": "architect/backend",
      "parameters": {
        "VOLUME_PATH": {
          "default": '/usr/src/volume2'
        }
      },
      "volumes": {
        "env_volume": {
          "mountPath": "/usr/src/volume1"
        },
        "parameter_env_volume": {
          "mountPath": "$VOLUME_PATH"
        }
      }
    };

    const env_config = {
      "services": {
        "architect/backend:latest": {
          "debug": {
            "path": "./src/backend",
            "volumes": {
              "env_volume": "/home/testUser/volume1",
              "parameter_env_volume": "/home/testUser/volume2"
            }
          }
        }
      }
    };

    mock_fs({
      '/stack/src/backend/architect.json': JSON.stringify(backend_json),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    compose = DockerCompose.generate(manager);
  });

  afterEach(function () {
    // Restore stubs
    sinon.restore();
    // Restore fs
    mock_fs.restore();
  });

  it('basic service config volume', async () => {
    expect(compose.services['architect.backend.latest'].volumes).to.include.members(['/home/testUser/volume1:/usr/src/volume1']);
  });

  it('service config volume from parameter', async () => {
    expect(compose.services['architect.backend.latest'].volumes).to.include.members(['/home/testUser/volume2:/usr/src/volume2']);
  });
});
