import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import path from 'path';
import { resourceRefToNodeRef } from '../../src';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../../src/common/docker-compose';

describe('volumes spec v1', () => {

  const test_component_api_safe_ref = resourceRefToNodeRef('component.services.api');
  const test_component_app_safe_ref = resourceRefToNodeRef('component.services.app');

  it('simple volume', async () => {
    const component_config = `
      name: component
      services:
        api:
          debug:
            volumes:
              data:
                mount_path: /data
      `
    mock_fs({
      '/component/component.yml': component_config,
    });
    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'component': '/component/component.yml'
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('component', {}, true)
    ])
    const template = await DockerComposeUtils.generate(graph);
    expect(template.services[test_component_api_safe_ref].volumes).has.members(['api-data:/data'])
  });

  it('simple debug volume', async () => {
    const component_config = `
      name: component
      services:
        api:
          debug:
            volumes:
              data:
                mount_path: /data
                host_path: ./data
      `
    mock_fs({
      '/component/component.yml': component_config,
    });
    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'component': '/component/component.yml'
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('component', {}, true)
    ]);
    const template = await DockerComposeUtils.generate(graph);
    expect(template.services[test_component_api_safe_ref].volumes).has.members([`${path.resolve('/component/data')}:/data`])
  });

  it('simple external volume', async () => {
    const component_config = `
      name: component
      services:
        api:
          debug:
            volumes:
              data:
                mount_path: /data
                key: /user/app/data
      `
    mock_fs({
      '/component/component.yml': component_config,
    });
    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'component': '/component/component.yml'
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('component', {}, true)
    ])
    const template = await DockerComposeUtils.generate(graph);
    expect(template.services[test_component_api_safe_ref].volumes).has.members([`/user/app/data:/data`])
  });

  it('multiple volumes and services', async () => {
    const component_config = `
      name: component
      services:
        api:
          debug:
            volumes:
              data:
                mount_path: /data
              data2:
                mount_path: /data2
              data3:
                mount_path: /data3
                host_path: ./data3
        app:
          debug:
            volumes:
              data:
                mount_path: /data
              data2:
                mount_path: /data2
              data3:
                mount_path: /data3
                host_path: ./data3
      `
    mock_fs({
      '/component/component.yml': component_config,
    });
    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'component': '/component/component.yml'
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('component', {}, true)
    ])
    const template = await DockerComposeUtils.generate(graph);
    expect(template.services[test_component_api_safe_ref].volumes).has.members(['api-data:/data', 'api-data2:/data2', `${path.resolve('/component/data3')}:/data3`])
    expect(template.services[test_component_app_safe_ref].volumes).has.members(['app-data:/data', 'app-data2:/data2', `${path.resolve('/component/data3')}:/data3`])
  });
});
