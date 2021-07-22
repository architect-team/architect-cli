import { expect } from '@oclif/test';
import axios from 'axios';
import yaml from 'js-yaml';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Register from '../../src/commands/register';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import PortUtil from '../../src/common/utils/port';
import { ComponentConfigBuilder } from '../../src/dependency-manager/src/spec/component/component-builder';
import { ValuesConfig } from '../../src/dependency-manager/src/spec/values/values';
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

    it('valid service depends_on', async () => {
      const component_config = `
      name: test/component
      services:
        stateful-app:
          depends_on:
            - backend
          interfaces:
            main: 8080
        backend:
          interfaces:
            main: 5432
      interfaces:
        frontend: \${{ services['stateful-app'].interfaces.main.url }}
      `
      mock_fs({ '/architect.yml': component_config });
      await ComponentConfigBuilder.buildFromPath('/architect.yml')
    });

    it('valid task depends_on', async () => {
      const component_config = `
      name: test/component
      tasks:
        some-task:
          depends_on:
            - stateful-app
          schedule: "*/5 * * * ?"
          image: ellerbrock/alpine-bash-curl-ssl
      services:
        stateful-app:
          interfaces:
            main: 8080
        backend:
          interfaces:
            main: 5432
      interfaces:
        frontend: \${{ services['stateful-app'].interfaces.main.url }}
      `
      mock_fs({ '/architect.yml': component_config });
      await ComponentConfigBuilder.buildFromPath('/architect.yml')
    });

    it('invalid task depends_on', async () => {
      const component_config = `
      name: test/component
      tasks:
        some-task:
          schedule: "*/5 * * * ?"
          image: ellerbrock/alpine-bash-curl-ssl
      services:
        stateless-app:
          depends_on:
            - some-task
          interfaces:
            main: 8080
      interfaces:
        frontend: \${{ services['stateless-app'].interfaces.main.url }}
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
        "depends_on": {
          "no-task-dependency": "stateless-app.depends_on[some-task] must refer to a service, not a task",
          "value": "stateless-app",
          "line": 9,
          "column": 21
        }
      })
    });

    it('invalid service self reference', async () => {
      const component_config = `
      name: test/component
      services:
        stateless-app:
          depends_on:
            - stateless-app
          interfaces:
            main: 8080
      interfaces:
        frontend: \${{ services['stateless-app'].interfaces.main.url }}
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
        "depends_on": {
          "circular-reference": "stateless-app.depends_on must not contain a circular reference",
          "value": "stateless-app",
          "line": 5,
          "column": 21
        }
      })
    });

    it('invalid service reference', async () => {
      const component_config = `
      name: test/component
      services:
        stateless-app:
          depends_on:
            - non-existant
          interfaces:
            main: 8080
      interfaces:
        frontend: \${{ services['stateless-app'].interfaces.main.url }}
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
        "depends_on": {
          "invalid-reference": "stateless-app.depends_on[non-existant] must refer to a valid service",
          "value": "stateless-app",
          "line": 5,
          "column": 21
        }
      })
    });

    it('invalid circular service reference', async () => {
      const component_config = `
      name: test/component
      services:
        stateful-app:
          depends_on:
            - backend
          interfaces:
            main: 8080
        backend:
          depends_on:
            - stateful-app
          interfaces:
            main: 5432
      interfaces:
        frontend: \${{ services['stateful-app'].interfaces.main.url }}
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
        "depends_on": {
          "circular-reference": "backend.depends_on must not contain a circular reference",
          "value": "backend",
          "line": 5,
          "column": 21
        }
      })
    });

    it('invalid deep circular service reference', async () => {
      const component_config = `
      name: test/component
      services:
        stateful-app:
          depends_on:
            - api
          interfaces:
            main: 8080
        api:
          depends_on:
            - backend
          interfaces:
            main: 8081
        backend:
          depends_on:
            - stateful-app
          interfaces:
            main: 5432
      interfaces:
        frontend: \${{ services['stateful-app'].interfaces.main.url }}
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
        "depends_on": {
          "circular-reference": "backend.depends_on must not contain a circular reference",
          "value": "backend",
          "line": 5,
          "column": 21
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
      const other_component_config = `
      name: test/other
      interfaces:
      services:
        api:
          interfaces:
          environment:
      `

      mock_fs({
        '/component.yml': component_config,
        '/other-component.yml': other_component_config,
      });
      const manager = new LocalDependencyManager(axios.create(), {
        'test/component': '/component.yml',
        'test/other': '/other-component.yml'
      });
      let validation_err;
      try {
        await manager.getGraph([
          await manager.loadComponentConfig('test/component'),
          await manager.loadComponentConfig('test/other')
        ]);
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

    it('deploy time validation', async () => {
      const component_config = `
      name: test/component
      parameters:
        app_liveness_path: /health
      services:
        app:
          liveness_probe:
            path: \${{ parameters.app_liveness_path }}
            port: 8080
        api:
          liveness_probe:
            path: http://localhost/
            port: 8080
      `
      mock_fs({
        '/component.yml': component_config,
      });
      const manager = new LocalDependencyManager(axios.create(), {
        'test/component': '/component.yml',
      });
      let validation_err;
      try {
        await manager.getGraph([
          await manager.loadComponentConfig('test/component'),
        ]);
      } catch (err) {
        validation_err = err;
      }
      expect(validation_err).instanceOf(ValidationErrors)
      expect(validation_err.errors).to.deep.eq({
        "services.api.liveness_probe.path": {
          "matches": "Path should start with /. Ex. /health",
          "value": "http://localhost/",
          "column": 17,
          "line": 12,
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

      const other_component_config = `
      name: test/other
      interfaces:
      services:
        api:
          interfaces:
          environment:
      `
      mock_fs({
        '/test-file.txt': `some file text\non another line`,
        '/component.yml': component_config,
        '/other-component.yml': other_component_config,
      });

      const manager = new LocalDependencyManager(axios.create(), {
        'test/component': '/component.yml',
        'test/other': '/other-component.yml'
      });
      let validation_err;
      try {
        await manager.getGraph([
          await manager.loadComponentConfig('test/component'),
          await manager.loadComponentConfig('test/other')
        ]);
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

  describe('required parameter validation', () => {
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
      mock_fs({
        '/component.yml': component_config,
      });
      const manager = new LocalDependencyManager(axios.create(), {
        'test/component': '/component.yml',
      });
      let validation_err;
      try {
        await manager.getGraph([
          await manager.loadComponentConfig('test/component'),
        ]);
      } catch (err) {
        validation_err = err;
      }
      expect(validation_err).instanceOf(ValidationErrors)
      expect(validation_err.errors).to.deep.eq({
        'components.test/component.parameters.required': {
          'Required': 'required is required',
          'value': undefined,
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

      mock_fs({
        '/architect.yml': component_config,
      });

      moxios.stubRequest(`/accounts/examples/components/hello-world2/versions/latest`, {
        status: 200,
        response: { tag: 'latest', config: yaml.load(component_config2), service: { url: 'examples/hello-world2:latest' } }
      });

      const manager = new LocalDependencyManager(axios.create(), {
        'examples/hello-world': '/architect.yml',
      });
      let validation_err;
      try {
        const component_config = await manager.loadComponentConfig('examples/hello-world');
        await manager.getGraph([
          ...await manager.loadComponentConfigs(component_config),
        ]);
      } catch (err) {
        validation_err = err;
      }
      expect(validation_err).instanceOf(ValidationErrors)
      expect(validation_err.errors).to.deep.eq({
        'components.examples/hello-world2.parameters.aws_secret': {
          'Required': 'aws_secret is required',
          'value': undefined,
        }
      })
    });
  });

  it('valid component keys in values files pass validation', () => {
    const values_dict = {
      "*": {
        "POSTGRES_HOST": "172.17.0.1"
      },
      "architect/cloud:latest": {
        "TEST": "string"
      }

    };

    let passed_validation = false;
    try {
      ValuesConfig.validate(values_dict)
      passed_validation = true;
    } catch (err) { }
    expect(passed_validation).true;
  });

  it('invalid component keys in values files fail validation', () => {
    const values_dict = {
      "architect_cloud:latest": {
        "TEST": "string"
      }
    };

    try {
      ValuesConfig.validate(values_dict)
    } catch (err) {
      const validation_error = Object.values(err.errors)[0] as any;
      expect(validation_error.Invalid).eq(`architect_cloud:latest must be a full or partial component reference, optionally ending with an asterisk.`);
      expect(validation_error.line).eq(2);
      expect(validation_error.column).eq(27);
    }
  });

  it('invalid value keys in values files fail validation', () => {
    const values_dict = {
      "architect/cloud:latest": {
        "TE-ST": "string"
      }
    };

    try {
      ValuesConfig.validate(values_dict)
    } catch (err) {
      const validation_error = Object.values(err.errors)[0] as any;
      expect(validation_error.Invalid).eq(`TE-ST should only contain alphanumerics and underscores, and cannot start or end with an underscore.`);
      expect(validation_error.line).eq(3);
      expect(validation_error.column).eq(12);
    }
  });

  it('component values are defined in an object', () => {
    const values_dict = {
      "architect/cloud:latest": [],
      "architect/cloud:*": 'string'
    };

    try {
      ValuesConfig.validate(values_dict)
    } catch (err) {
      const array_validation_error = Object.values(err.errors)[0] as any;
      const string_validation_error = Object.values(err.errors)[1] as any;
      expect(array_validation_error.Invalid).eq(`The value for architect/cloud:latest must be an object.`);
      expect(array_validation_error.line).eq(2);
      expect(array_validation_error.column).eq(27);
      expect(string_validation_error.Invalid).eq(`The value for architect/cloud:* must be an object.`);
      expect(string_validation_error.line).eq(2);
      expect(string_validation_error.column).eq(19);
    }
  });

  it('component values are strings only', () => {
    const values_dict = {
      "architect/cloud:latest": {
        'test': 'test value'
      },
      "architect/cloud:*": {
        'ANOTHER_test': 'another value'
      }
    };

    try {
      ValuesConfig.validate(values_dict)
    } catch (err) {
      const array_validation_error = Object.values(err.errors)[0] as any;
      const string_validation_error = Object.values(err.errors)[1] as any;
      expect(array_validation_error.Invalid).eq(`test must be a string.`);
      expect(array_validation_error.line).eq(3);
      expect(array_validation_error.column).eq(11);
      expect(string_validation_error.Invalid).eq(`ANOTHER_test must be a string.`);
      expect(string_validation_error.line).eq(6);
      expect(string_validation_error.column).eq(19);
    }
  });

  describe('AtLeastOne and scaling validation', () => {
    it('required component parameters', async () => {
      const component_config = `
      name: test/component
      services:
        api:
          interfaces:
            main: 8080
          scaling:
            min_replicas: 1
            max_replicas: 1
            metrics:
      `
      mock_fs({
        '/component.yml': component_config,
      });
      const manager = new LocalDependencyManager(axios.create(), {
        'test/component': '/component.yml',
      });
      let validation_err;
      try {
        await manager.getGraph([
          await manager.loadComponentConfig('test/component'),
        ]);
      } catch (err) {
        validation_err = err;
      }
      expect(validation_err).instanceOf(ValidationErrors)
      expect(validation_err.errors).to.deep.eq({
        "services.api.scaling.metrics": {
          at_least_one: "Either a cpu metric, a memory metric, or both must be defined.",
          column: 20,
          line: 10,
          value: null,
        }});
      })
    });
});
