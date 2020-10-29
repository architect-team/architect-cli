import { expect } from '@oclif/test';
import axios from 'axios';
import yaml from 'js-yaml';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Register from '../../src/commands/register';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import PortUtil from '../../src/common/utils/port';
import { EnvironmentConfigBuilder } from '../../src/dependency-manager/src';
import { ComponentConfigBuilder } from '../../src/dependency-manager/src/component-config/builder';
import { ValidationErrors } from '../../src/dependency-manager/src/utils/errors';

describe('validation spec v1', () => {
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
        frontend: \${{ services['stateless-app'].interfaces.main.url }}
      `
      mock_fs({ '/architect.yml': component_config });
      await ComponentConfigBuilder.buildFromPath('/architect.yml')
    });

    it('invalid nested debug', async () => {
      const component_config = `
      name: test/component
      services:
        stateless-app:
          interfaces:
          environment:
            LOG_LEVEL: error
          debug:
            environment:
              LOG_LEVEL: info
            debug:
              environment:
                LOG_LEVEL: debug
      interfaces:
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
        "services.stateless-app.debug.debug": {
          "isEmpty": "debug must be empty",
          "value": "[object Object]",
          "line": 11,
          "column": 18
        }
      })
    });

    it('invalid service ref', async () => {
      const component_config = `
      name: test/component
      services:
        stateless-app:
          interfaces:
            main: 8080
      interfaces:
        frontend: \${{ services.fake.interfaces.main.url }}
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
          "interpolation": "${{ services.fake.interfaces.main.url }} is invalid",
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
            test2: \${{ parameters.test }}
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
          "value": '[object Object]',
          "whitelistValidation": "property services should not exist"
        }
      })
    });
  })

  describe('environment builder validation', () => {
    it('file reference does not misalign validation error line numbers', async () => {
      const env_config = `
      components:
        test/component:
          extends: latest
          parameters:
            TEST_FILE_TEXT: file:./test-file.txt
      services:
        stateless-app:
      `

      mock_fs({
        '/test-file.txt': `some file text\non another line`,
        '/environment.yml': env_config
      });

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
          "line": 7,
          "value": '[object Object]',
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
            OTHER_ADDR: \${{ dependencies.test/other.interfaces.fake.url }}
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
          "interpolation": "${{ dependencies.test/other.interfaces.fake.url }} is invalid",
          "value": "dependencies.test/other.interfaces.fake.url",
          "column": 24,
          "line": 8,
        }
      })
    });
  });

  describe('component builder validation', () => {
    it('file reference does not misalign validation error line numbers', async () => {
      const component_config = `
      name: test/component
      interfaces:
      services:
        api:
          interfaces:
          environment:
            TEST_FILE_TEXT: file:./test-file.txt
            OTHER_ADDR: \${{ dependencies.test/other.interfaces.fake.url }}
      dependencies:
        test/other: latest
      `

      const env_config = `
      components:
        test/component: file:./component.yml
        test/other: file:./component.yml
      `
      mock_fs({
        '/test-file.txt': `some file text\non another line`,
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
          "interpolation": "${{ dependencies.test/other.interfaces.fake.url }} is invalid",
          "value": "dependencies.test/other.interfaces.fake.url",
          "column": 24,
          "line": 9,
        }
      })
    });
  });

  // Environment Validation
  describe('environment validation', () => {
    it('invalid component syntax', async () => {
      const env_config = `
      components:
        examples/stateful-component:latest
      `
      mock_fs({
        '/environment.yml': env_config
      });

      let validation_err;
      try {
        const manager = await LocalDependencyManager.createFromPath(axios.create(), '/environment.yml');
        await manager.getGraph();
      } catch (err) {
        validation_err = err;
      }
      expect(validation_err).instanceOf(ValidationErrors)
      expect(validation_err.errors).to.deep.eq({
        "components": {
          "isObject": "components must be an object",
          "value": "examples/stateful-component:latest",
          "line": 2,
          "column": 17
        }
      })
    });

    it('required component parameters', async () => {
      const component_config = `
      name: test/component
      parameters:
        required:
        required-explicit:
          required: true
        not-required:
          required: false
      services:
        api:
          interfaces:
            main: 8080
          environment:
            REQUIRED: \${{ parameters.required }}
            REQUIRED_EXPLICIT: \${{ parameters.required-explicit }}
            NOT_REQUIRED: \${{ parameters.not-required }}
      interfaces:
      `
      const env_config = `
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
        'components.test/component.parameters.required': {
          'Required': 'required is required',
          'value': null,
        },
        'components.test/component.parameters.required-explicit': {
          'Required': 'required-explicit is required',
          'value': undefined
        }
      })
    });

    it('required dependency parameter', async () => {
      const component_config = `
      name: examples/hello-world

      dependencies:
        examples/hello-world2: latest

      services:
        api:
          image: heroku/nodejs-hello-world
          interfaces:
            main: 3000

      interfaces:
        echo:
          url: \${{ services.api.interfaces.main.url }}
      `

      const component_config2 = `
      name: examples/hello-world2

      parameters:
        aws_secret:

      services:
        api:
          image: heroku/nodejs-hello-world
          interfaces:
            main: 3000
          environment:
            AWS_SECRET: \${{ parameters.aws_secret }}

      interfaces:
        echo:
          url: \${{ services.api.interfaces.main.url }}
      `

      const env_config = `
      components:
        examples/hello-world: file:./architect.yml
      `

      mock_fs({
        '/architect.yml': component_config,
        '/environment.yml': env_config,
      });

      moxios.stubRequest(`/accounts/examples/components/hello-world2/versions/latest`, {
        status: 200,
        response: { tag: 'latest', config: yaml.safeLoad(component_config2), service: { url: 'examples/hello-world2:latest' } }
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
        'components.examples/hello-world2.parameters.aws_secret': {
          'Required': 'aws_secret is required',
          'value': null,
        }
      })
    });

    it('required environment parameters', async () => {
      const component_config = `
      name: test/component
      parameters:
        required:
        required-explicit:
        not-required:
          required: false
      services:
        api:
          interfaces:
            main: 8080
          environment:
            REQUIRED: \${{ parameters.required }}
            REQUIRED_EXPLICIT: \${{ parameters.required-explicit }}
            NOT_REQUIRED: \${{ parameters.not-required }}
      interfaces:
      `
      const env_config = `
      parameters:
        required:
        required-explicit:
          required: true
        not-required:
          required: false
      components:
        test/component:
          extends: file:./component.yml
          parameters:
            required: \${{ parameters.required }}
            required-explicit: \${{ parameters.required-explicit }}
            not-required: \${{ parameters.not-required }}
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
        'parameters.required': {
          Required: 'required is required',
          line: 3,
          column: 17,
          value: null,
        },
        'parameters.required-explicit': {
          Required: 'required-explicit is required',
          line: 4,
          column: 26,
          value: undefined
        }
      });
    });

    it('valid component interfaces ref', async () => {
      const component_config = `
      name: test/component
      services:
        api:
          interfaces:
            main: 8080
      interfaces:
        api: \${{ services.api.interfaces.main.url }}
      `
      const env_config = `
      interfaces:
        public: \${{ components.test/component.interfaces.api.url }}
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
        api: \${{ services.api.interfaces.main.url }}
      `
      const env_config = `
      interfaces:
        public: \${{ components.test/component.interfaces.fake.url }}
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
          "interpolation": "${{ components.test/component.interfaces.fake.url }} is invalid",
          "value": "components.test/component.interfaces.fake.url",
          "line": 3,
          "column": 16
        }
      })
    });

    it('invalid vault ref', async () => {
      const env_config = `
      parameters:
        invalid: \${{ vaults.invalid.some_key }}
        valid: \${{ vaults.valid.some_key }}
      vaults:
        valid: {}
      `
      mock_fs({
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
        'interpolation.vaults.invalid.some_key': {
          'interpolation': '${{ vaults.invalid.some_key }} is invalid',
          'value': 'vaults.invalid.some_key',
          'line': 3,
          'column': 17,
        }
      })
    });

    it('valid component:tag ref', async () => {
      const component_config = `
      name: test/component
      services:
        api:
          interfaces:
            main: 8080
      interfaces:
        api: \${{ services.api.interfaces.main.url }}
      `
      const env_config = `
      interfaces:
        public: \${{ components['test/component:v1.0'].interfaces.api.url }}
      components:
        test/component:v1.0: file:./component.yml
      `
      mock_fs({
        '/component.yml': component_config,
        '/environment.yml': env_config
      });
      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/environment.yml');
      await manager.getGraph();
    });

    it('invalid component:tag ref', async () => {
      const component_config = `
      name: test/component
      services:
        api:
          interfaces:
            main: 8080
      interfaces:
        api: \${{ services.api.interfaces.main.url }}
      `
      const env_config = `
      interfaces:
        public: \${{ components['test/component:v2.0'].interfaces.main.url }}
      components:
        test/component:v1.0: file:./component.yml
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
        "interpolation.components.test/component:v2.0.interfaces.main.url": {
          "interpolation": "${{ components.test/component:v2.0.interfaces.main.url }} is invalid",
          "value": "components.test/component:v2.0.interfaces.main.url",
          "line": 3,
          "column": 16
        }
      })
    });

    it('invalid interface in service spec', async () => {
      const component_config = `
      name: test/component
      services:
        api:
          interfaces:
            main:
              port: 8080
              domains:
                - invalid-domain
      interfaces:
      `
      const env_config = `
      components:
        test/component:v1.0: file:./component.yml
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
        "services.api.interfaces.main.domains": {
          "isUrl": "each value in domains must be an URL address",
          "value": "invalid-domain",
          "line": 8,
          "column": 22
        }
      })
    });
  })
});
