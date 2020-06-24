/**
 * @format
 */
import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import path from 'path';
import sinon from 'sinon';
import Build from '../../src/commands/build';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import * as DockerCompose from '../../src/common/docker-compose';
import PortUtil from '../../src/common/utils/port';

describe('volumes spec v1', () => {
  beforeEach(async () => {
    // Stub the logger
    sinon.replace(Build.prototype, 'log', sinon.stub());
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
    const env_config = `
      components:
        test/component: file:./component/component.yml
      `
    mock_fs({
      '/component/component.yml': component_config,
      '/environment.yml': env_config
    });
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/environment.yml');
    const template = await DockerCompose.generate(manager);
    expect(template.services['test.component.api.latest'].volumes).has.members(['/data'])
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
    const env_config = `
      components:
        test/component: file:./component/component.yml
      `
    mock_fs({
      '/component/component.yml': component_config,
      '/environment.yml': env_config
    });
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/environment.yml');
    const template = await DockerCompose.generate(manager);
    expect(template.services['test.component.api.latest'].volumes).has.members([`${path.resolve('/component/data')}:/data`])
  });

  it('multiple volumes', async () => {
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

      interfaces:
      `
    const env_config = `
      components:
        test/component: file:./component/component.yml
      `
    mock_fs({
      '/component/component.yml': component_config,
      '/environment.yml': env_config
    });
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/environment.yml');
    const template = await DockerCompose.generate(manager);
    expect(template.services['test.component.api.latest'].volumes).has.members(['/data', '/data2', `${path.resolve('/component/data3')}:/data3`])
  });

  it('override host_path for volume in env', async () => {
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
    const env_config = `
      components:
        test/component:
          extends: file:./component/component.yml
          services:
            api:
              volumes:
                data:
                  mount_path: /data-override
                  host_path: ./data-override
      `
    mock_fs({
      '/component/component.yml': component_config,
      '/environment.yml': env_config
    });
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/environment.yml');
    const template = await DockerCompose.generate(manager);
    expect(template.services['test.component.api.latest'].volumes).has.members([`${path.resolve('/data-override')}:/data-override`])
  });

  it('override host_path for debug volume in env', async () => {
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
    const env_config = `
      components:
        test/component:
          extends: file:./component/component.yml
          services:
            api:
              volumes:
                data:
                  mount_path: /data-override
                  host_path: ./data-override
      `
    mock_fs({
      '/component/component.yml': component_config,
      '/environment.yml': env_config
    });
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/environment.yml');
    const template = await DockerCompose.generate(manager);
    expect(template.services['test.component.api.latest'].volumes).has.members([`${path.resolve('/data-override')}:/data-override`])
  });

  it('define new volume in env', async () => {
    const component_config = `
      name: test/component
      services:
        api:
          interfaces:
      interfaces:
      `
    const env_config = `
      components:
        test/component:
          extends: file:./component/component.yml
          services:
            api:
              volumes:
                data:
                  mount_path: /data-override
                  host_path: ./data-override
      `
    mock_fs({
      '/component/component.yml': component_config,
      '/environment.yml': env_config
    });
    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/environment.yml');
    const template = await DockerCompose.generate(manager);
    expect(template.services['test.component.api.latest'].volumes).has.members([`${path.resolve('/data-override')}:/data-override`])
  });
});
