import axios from 'axios';
import { expect } from 'chai';
import yaml from 'js-yaml';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Register from '../../src/commands/register';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import PortUtil from '../../src/common/utils/port';
import { ComponentConfig, ServiceNode } from '../../src/dependency-manager/src';

describe('interpolation spec v1', () => {
  beforeEach(() => {
    // Stub the logger
    sinon.replace(Register.prototype, 'log', sinon.stub());
    moxios.install();

    sinon.replace(PortUtil, 'isPortAvailable', async () => true);
    PortUtil.reset();

    moxios.wait(function () {
      let request = moxios.requests.mostRecent()
      if (request) {
        request.respondWith({
          status: 404,
        })
      }
    })

    moxios.stubRequest(`/v1/auth/approle/login`, {
      status: 200,
      response: { auth: {} }
    });
  });

  afterEach(() => {
    // Restore stubs
    sinon.restore();
    // Restore fs
    mock_fs.restore();
    moxios.uninstall();
  });

  it('debug block does apply for local component', async () => {
    const component_config = `
    name: examples/hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          NODE_ENV: production
        debug:
          environment:
            NODE_ENV: development

    interfaces:
      echo:
        url: \${{ services.api.interfaces.main.url }}
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'examples/hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('examples/hello-world'),
    ]);
    const api_ref = ComponentConfig.getNodeRef('examples/hello-world/api:latest');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.config.getEnvironmentVariables()).to.deep.eq({
      NODE_ENV: 'development'
    });
  });

  it('debug block does not apply for remote component', async () => {
    const component_config = `
    name: examples/hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          NODE_ENV: production
        debug:
          environment:
            NODE_ENV: development

    interfaces:
      echo:
        url: \${{ services.api.interfaces.main.url }}
    `

    moxios.stubRequest(`/accounts/examples/components/hello-world/versions/latest`, {
      status: 200,
      response: { tag: 'latest', config: yaml.safeLoad(component_config), service: { url: 'examples/hello-world:latest' } }
    });

    const manager = new LocalDependencyManager(axios.create());
    const graph = await manager.getGraph([
      await manager.loadComponentConfig('examples/hello-world'),
    ]);
    const api_ref = ComponentConfig.getNodeRef('examples/hello-world/api:latest');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.config.getEnvironmentVariables()).to.deep.eq({
      NODE_ENV: 'production'
    });
  });
});
