import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import sinon from 'sinon';
import Build from '../../../src/commands/build';
import LocalDependencyManager from '../../../src/common/dependency-manager/local-manager';
import { ServiceNode } from '../../../src/dependency-manager/src';


describe('liveness probes', function () {
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

  it('full liveness probe override', async () => {
    const service_config = {
      name: "architect/backend",
      liveness_probe: {
        path: '/health',
        port: 8082,
        success_threshold: 2,
        failure_threshold: 3,
        timeout: '10s',
        interval: '90s',
      }
    };

    const env_config = {
      services: {
        "architect/backend": {
          debug: {
            path: 'src/backend'
          }
        },
      }
    };

    mock_fs({
      '/stack/src/backend/architect.json': JSON.stringify(service_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const liveness_probe = (manager.graph.getNodeByRef('architect/backend/service:latest') as ServiceNode).node_config.getLivenessProbe();

    expect(liveness_probe!.command).undefined;
    expect(liveness_probe!.path).eq('/health');
    expect(liveness_probe!.port).eq(8082);
    expect(liveness_probe!.success_threshold).eq(2);
    expect(liveness_probe!.failure_threshold).eq(3);
    expect(liveness_probe!.timeout).eq('10s');
    expect(liveness_probe!.interval).eq('90s');
  });

  it('partial liveness probe override', async () => {
    const service_config = {
      name: "architect/backend",
      liveness_probe: {
        command: ['curl 0.0.0.0:8080 && exit 0'],
        timeout: '20s'
      }
    };

    const env_config = {
      services: {
        "architect/backend": {
          debug: {
            path: 'src/backend'
          }
        },
      }
    };

    mock_fs({
      '/stack/src/backend/architect.json': JSON.stringify(service_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const liveness_probe = (manager.graph.getNodeByRef('architect/backend/service:latest') as ServiceNode).node_config.getLivenessProbe();

    expect(liveness_probe!.path).undefined;
    expect(liveness_probe!.port).undefined;
    expect(liveness_probe!.command).members(['curl 0.0.0.0:8080 && exit 0']);
    expect(liveness_probe!.success_threshold).eq(1);
    expect(liveness_probe!.failure_threshold).eq(1);
    expect(liveness_probe!.timeout).eq('20s');
    expect(liveness_probe!.interval).eq('30s');
  });

  it('liveness probe with path', async () => {
    const service_config = {
      name: "architect/backend",
      liveness_probe: {
        path: '/test',
        port: 8080,
        success_threshold: 7
      }
    };

    const env_config = {
      services: {
        "architect/backend": {
          debug: {
            path: 'src/backend'
          }
        },
      }
    };

    mock_fs({
      '/stack/src/backend/architect.json': JSON.stringify(service_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const liveness_probe = (manager.graph.getNodeByRef('architect/backend/service:latest') as ServiceNode).node_config.getLivenessProbe();

    expect(liveness_probe!.command).undefined;
    expect(liveness_probe!.path).eq('/test');
    expect(liveness_probe!.port).eq(8080);
    expect(liveness_probe!.success_threshold).eq(7);
    expect(liveness_probe!.failure_threshold).eq(1);
    expect(liveness_probe!.timeout).eq('5s');
    expect(liveness_probe!.interval).eq('30s');
  });

  it('default liveness probe', async () => {
    const service_config = {
      name: "architect/backend"
    };

    const env_config = {
      services: {
        "architect/backend": {
          debug: {
            path: 'src/backend'
          }
        },
      }
    };

    mock_fs({
      '/stack/src/backend/architect.json': JSON.stringify(service_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const liveness_probe = (manager.graph.getNodeByRef('architect/backend/service:latest') as ServiceNode).node_config.getLivenessProbe();

    expect(liveness_probe).undefined;
  });
});
