import { expect } from 'chai';
import mock_fs from 'mock-fs';
import { buildSpecFromPath } from '../../src';

describe('config spec v1', () => {
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

    const component_spec = buildSpecFromPath('/architect.yml');
    expect(component_spec.interfaces?.frontend).to.eq("${{ services['stateless-app'].interfaces.main.url }}")
  });

  /*
  TODO:269 decide if we support .key properties
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

    const { component_config } = buildSpecFromPath('/architect.yml');
    expect(component_config.interfaces.frontend.url).to.eq("${{ services['stateless-app'].interfaces.main.url }}")
  });
  */
});
