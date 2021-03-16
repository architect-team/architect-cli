import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import path from 'path';
import sinon from 'sinon';
import Register from '../../src/commands/register';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../../src/common/docker-compose';
import PortUtil from '../../src/common/utils/port';
import { Refs } from '../../src/dependency-manager/src';

describe('volumes spec v1', () => {
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
    })
    sinon.replace(PortUtil, 'isPortAvailable', async () => true);
    PortUtil.reset();
  });

  afterEach(function () {
    // Restore stubs
    sinon.restore();
    // Restore fs
    mock_fs.restore();
    moxios.uninstall();
  });

  const test_component_api_url_safe_ref = Refs.url_safe_ref('test/component/api:latest');
  const test_component_app_url_safe_ref = Refs.url_safe_ref('test/component/app:latest');

  it('simple volume', async () => {
    const component_config = `
      name: test/component
      services:
        api:
          interfaces:
          volumes:
            data:
              mount_path: /data
      interfaces:
      `
    mock_fs({
      '/component/component.yml': component_config,
    });
    const manager = new LocalDependencyManager(axios.create(), {
      'test/component': '/component/component.yml'
    });
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('test/component')
    ])
    const template = await DockerComposeUtils.generate(graph);
    expect(template.services[test_component_api_url_safe_ref].volumes).has.members(['/data'])
  });

  it('simple debug volume', async () => {
    const component_config = `
      name: test/component
      services:
        api:
          interfaces:
          debug:
            volumes:
              data:
                mount_path: /data
                host_path: ./data
      interfaces:
      `
    mock_fs({
      '/component/component.yml': component_config,
    });
    const manager = new LocalDependencyManager(axios.create(), {
      'test/component': '/component/component.yml'
    });
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('test/component')
    ])
    const template = await DockerComposeUtils.generate(graph);
    expect(template.services[test_component_api_url_safe_ref].volumes).has.members([`${path.resolve('/component/data')}:/data`])
  });

  it('multiple volumes and services', async () => {
    const component_config = `
      name: test/component
      services:
        api:
          interfaces:
          volumes:
            data:
              mount_path: /data
            data2:
              mount_path: /data2
          debug:
            volumes:
              data3:
                mount_path: /data3
                host_path: ./data3
        app:
          interfaces:
          volumes:
            data:
              mount_path: /data
            data2:
              mount_path: /data2
          debug:
            volumes:
              data3:
                mount_path: /data3
                host_path: ./data3

      interfaces:
      `
    mock_fs({
      '/component/component.yml': component_config,
    });
    const manager = new LocalDependencyManager(axios.create(), {
      'test/component': '/component/component.yml'
    });
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('test/component')
    ])
    const template = await DockerComposeUtils.generate(graph);
    expect(template.services[test_component_api_url_safe_ref].volumes).has.members(['/data', '/data2', `${path.resolve('/component/data3')}:/data3`])
    expect(template.services[test_component_app_url_safe_ref].volumes).has.members(['/data', '/data2', `${path.resolve('/component/data3')}:/data3`])
  });
});
