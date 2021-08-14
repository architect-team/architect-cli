import { expect } from 'chai';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Register from '../../src/commands/register';
import PortUtil from '../../src/common/utils/port';
import { buildConfigFromPath, Slugs } from '../../src/dependency-manager/src';

describe('config spec v1', () => {
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

  it('simple configs', async () => {
    const component_yml = `
      name: test/component
      services:
        stateless-app:
          interfaces:
            main: 8080
      interfaces:
        frontend: \${{ services['stateless-app'].interfaces.main.url }}
      `
    mock_fs({
      '/architect.yml': component_yml,
    });

    const { component_config } = buildConfigFromPath('/architect.yml', Slugs.DEFAULT_TAG);
    expect(component_config.interfaces.frontend.url).to.eq("${{ services['stateless-app'].interfaces.main.url }}")
  });

  it('configs with yaml refs', async () => {
    const component_yml = `
      .frontend_interface: &frontend_interface_ref
        frontend: \${{ services['stateless-app'].interfaces.main.url }}
      name: test/component
      services:
        stateless-app:
          interfaces:
            main: 8080
      interfaces: *frontend_interface_ref
      `
    mock_fs({
      '/architect.yml': component_yml,
    });

    const { component_config } = buildConfigFromPath('/architect.yml', Slugs.DEFAULT_TAG);
    expect(component_config.interfaces.frontend.url).to.eq("${{ services['stateless-app'].interfaces.main.url }}")
  });
});
