/**
 * @format
 */
import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Build from '../../src/commands/build';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import PortUtil from '../../src/common/utils/port';
import { EnvironmentConfigBuilder } from '../../src/dependency-manager/src';
import { ComponentConfigBuilder } from '../../src/dependency-manager/src/component-config/builder';
import { ValidationErrors } from '../../src/dependency-manager/src/utils/errors';

describe('validation spec v1', () => {
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

  // Component Config Validation
  describe('component config validation', () => {
    it('valid service ref brackets', async () => {
      const component_config = `
      name: test/component
      services:
        stateless-app:
          interfaces:
            main: 8080
      interfaces:
        frontend: \${ services['stateless-app'].interfaces.main.url }
      `
      mock_fs({ '/architect.yml': component_config });
      await ComponentConfigBuilder.buildFromPath('/architect.yml')
    });

    it('invalid service ref', async () => {
      const component_config = `
      name: test/component
      services:
        stateless-app:
          interfaces:
            main: 8080
      interfaces:
        frontend: \${ services.fake.interfaces.main.url }
      `
      mock_fs({ '/architect.yml': component_config });
      let validation_err;
      try {
        await ComponentConfigBuilder.buildFromPath('/architect.yml')
      } catch (err) {
        validation_err = err;
      }
      expect(validation_err).instanceOf(ValidationErrors)
      expect(validation_err.errors).to.deep.eq({
        "interpolation.services.fake.interfaces.main.url": {
          "interpolation": "${ services.fake.interfaces.main.url } is invalid",
          "value": "services.fake.interfaces.main.url",
          "line": 8,
          "column": 18
        }
      })
    });
  })

  // Environment Config Validation
  describe('environment config validation', () => {
    it('valid parameter ref brackets', async () => {
      const env_config = `
      parameters:
        test: worked
      components:
        test/component:
          parameters:
            test2: \${ parameters.test }
      `
      mock_fs({ '/environment.yml': env_config });
      await EnvironmentConfigBuilder.buildFromPath('/environment.yml')
    });

    it('invalid service block', async () => {
      const env_config = `
      components:
        test/component:
      services:
        stateless-app:
      `
      mock_fs({ '/environment.yml': env_config });
      let validation_err;
      try {
        await EnvironmentConfigBuilder.buildFromPath('/environment.yml')
      } catch (err) {
        validation_err = err;
      }
      expect(validation_err).instanceOf(ValidationErrors)
      expect(validation_err.errors).to.deep.eq({
        "services": {
          "column": 15,
          "line": 4,
          "value": {
            "stateless-app": null
          },
          "whitelistValidation": "property services should not exist"
        }
      })
    });
  })

  // Component Validation
  describe('component validation', () => {
    it('invalid component interfaces ref', async () => {
      const component_config = `
      name: test/component
      interfaces:
      services:
        api:
          interfaces:
          environment:
            OTHER_ADDR: \${ dependencies.test/other.interfaces.fake.url }
      dependencies:
        test/other: latest
      `
      const env_config = `
      components:
        test/component: file:./component.yml
        test/other: file:./component.yml
      `
      mock_fs({
        '/component.yml': component_config,
        '/environment.yml': env_config
      });
      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/environment.yml');
      let validation_err;
      try {
        await manager.getGraph();
      } catch (err) {
        validation_err = err;
      }
      expect(validation_err).instanceOf(ValidationErrors)
      expect(validation_err.errors).to.deep.eq({
        "interpolation.dependencies.test/other.interfaces.fake.url": {
          "interpolation": "${ dependencies.test/other.interfaces.fake.url } is invalid",
          "value": "dependencies.test/other.interfaces.fake.url",
          "column": 24,
          "line": 8,
        }
      })
    });
  });

  // Environment Validation
  describe('environment validation', () => {
    it('valid component interfaces ref', async () => {
      const component_config = `
      name: test/component
      services:
        api:
          interfaces:
            main: 8080
      interfaces:
        api: \${ services.api.interfaces.main.url }
      `
      const env_config = `
      interfaces:
        public: \${ components.test/component.interfaces.api.url }
      components:
        test/component: file:./component.yml
      `
      mock_fs({
        '/component.yml': component_config,
        '/environment.yml': env_config
      });
      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/environment.yml');
      await manager.getGraph();
    });

    it('invalid component interfaces ref', async () => {
      const component_config = `
      name: test/component
      services:
        api:
          interfaces:
            main: 8080
      interfaces:
        api: \${ services.api.interfaces.main.url }
      `
      const env_config = `
      interfaces:
        public: \${ components.test/component.interfaces.fake.url }
      components:
        test/component: file:./component.yml
      `
      mock_fs({
        '/component.yml': component_config,
        '/environment.yml': env_config
      });
      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/environment.yml');
      let validation_err;
      try {
        await manager.getGraph();
      } catch (err) {
        validation_err = err;
      }
      expect(validation_err).instanceOf(ValidationErrors)
      expect(validation_err.errors).to.deep.eq({
        "interpolation.components.test/component.interfaces.fake.url": {
          "interpolation": "${ components.test/component.interfaces.fake.url } is invalid",
          "value": "components.test/component.interfaces.fake.url",
          "line": 3,
          "column": 16
        }
      })
    });
  })
});
