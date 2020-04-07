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
          "default": '/tmp/volume_path'
        }
      },
      "volumes": {
        "service_config_volume": {
          "mountPath": "/tmp/volume"
        },
        "volume_from_param": {
          "mountPath": "$VOLUME_PATH"
        },
        "split_volume": {
          "mountPath": "/tmp:/vol/service_config"
        },
        "service_config_override": {
          "mountPath": "/tmp/overridden_path"
        }
      }
    };

    const env_config = {
      "services": {
        "architect/backend:latest": {
          "debug": {
            "path": "./src/backend",
            "volumes": {
              "service_config_override": "/tmp/service_config_overridden",
              "env_defined_volume": "/tmp/env_defined_volume"
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

  it('service config volume', async () => {
    expect(compose.services['architect.backend.latest'].volumes).to.include.members(['/tmp/volume']);
  });

  it('volume from parameter', async () => {
    expect(compose.services['architect.backend.latest'].volumes).to.include.members(['/tmp/volume_path']);
  });

  it('split volume with colon', async () => {
    expect(compose.services['architect.backend.latest'].volumes).to.include.members(['/tmp:/vol/service_config']);
  });

  it('volume path overridden from env config', async () => {
    expect(compose.services['architect.backend.latest'].volumes).to.include.members(['/tmp/service_config_overridden']);
  });

  it('volume path from env config', async () => {
    expect(compose.services['architect.backend.latest'].volumes).to.include.members(['/tmp/env_defined_volume']);
  });
});
