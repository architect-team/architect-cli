import axios from 'axios';
import { expect } from 'chai';
import yaml from 'js-yaml';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Register from '../../src/commands/register';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import PortUtil from '../../src/common/utils/port';
import { buildConfigFromPath, interpolateConfigOrReject, Slugs, ValidationError, ValidationErrors } from '../../src/dependency-manager/src';
import { ValuesConfig } from '../../src/dependency-manager/src/values/values';

describe('validate spec', () => {
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
      buildConfigFromPath('/architect.yml')
    });

    it('invalid nested debug', async () => {
      const component_config = `
name: test/component
services:
  stateless-app:
    environment:
      LOG_LEVEL: error
    debug:
      environment:
        LOG_LEVEL: info
      debug:
        environment:
          LOG_LEVEL: debug
      `
      mock_fs({ '/architect.yml': component_config });
      let err;
      try {
        buildConfigFromPath('/architect.yml')
      } catch (e) {
        err = e;
      }
      expect(err).instanceOf(ValidationErrors);
      const errors = JSON.parse(err.message) as ValidationError[];
      expect(errors).lengthOf(1);
      expect(errors[0].path).eq(`services.stateless-app.debug.debug`);
      expect(errors[0].message).includes(`Did you mean deploy?`);
      expect(errors[0].start?.row).eq(10);
      expect(errors[0].start?.column).eq(7);
      expect(errors[0].end?.row).eq(10);
      expect(errors[0].end?.column).eq(12);
    });

    it('invalid replicas value', async () => {
      const component_config = `
      name: test/component
      services:
        stateless-app:
          replicas: '1'
      `
      mock_fs({ '/architect.yml': component_config });
      let err;
      try {
        const { component_config } = buildConfigFromPath('/architect.yml')
        interpolateConfigOrReject(component_config, [])
      } catch (e) {
        err = e;
      }

      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message);
      expect(errors).lengthOf(1);
      expect(errors[0].path).eq(`services.stateless-app.replicas`);
      expect(errors[0].message).includes(`must be number or must be an interpolation`);
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
      let err;
      try {
        const { component_config } = buildConfigFromPath('/architect.yml')
        interpolateConfigOrReject(component_config, [])
      } catch (e) {
        err = e;
      }

      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message);
      expect(errors).lengthOf(1);
      expect(errors[0].message).includes(`services.stateless-app.interfaces.main.url`);
      expect(errors[0].path).eq(`interfaces.frontend`);
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
      buildConfigFromPath('/architect.yml')
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
      buildConfigFromPath('/architect.yml')
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
      let err;
      try {
        const { component_config } = buildConfigFromPath('/architect.yml')
        interpolateConfigOrReject(component_config, [])
      } catch (e) {
        err = e;
      }
      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message);
      expect(errors).lengthOf(1);
      expect(errors[0].path).eq(`services.stateless-app.depends_on`);
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
      let err;
      try {
        const { component_config } = buildConfigFromPath('/architect.yml')
        interpolateConfigOrReject(component_config, [])
      } catch (e) {
        err = e;
      }
      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message);
      expect(errors).lengthOf(1);
      expect(errors[0].path).eq(`services.stateless-app.depends_on`);
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
      let err;
      try {
        const { component_config } = buildConfigFromPath('/architect.yml')
        interpolateConfigOrReject(component_config, [])
      } catch (e) {
        err = e;
      }
      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message);
      expect(errors).lengthOf(1);
      expect(errors[0].path).eq(`services.stateless-app.depends_on`);
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
      let err;
      try {
        const { component_config } = buildConfigFromPath('/architect.yml')
        interpolateConfigOrReject(component_config, [])
      } catch (e) {
        err = e;
      }
      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message) as ValidationError[];
      expect(errors).lengthOf(2);
      expect(errors.map(e => e.path)).members([
        'services.stateful-app.depends_on',
        'services.backend.depends_on'
      ])
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
      let err;
      try {
        const { component_config } = buildConfigFromPath('/architect.yml')
        interpolateConfigOrReject(component_config, [])
      } catch (e) {
        err = e;
      }
      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message) as ValidationError[];
      expect(errors).lengthOf(3);
      expect(errors.map(e => e.path)).members([
        'services.stateful-app.depends_on',
        'services.api.depends_on',
        'services.backend.depends_on'
      ])
    });
  })

  describe('component validation', () => {
    it('invalid component name', async () => {
      const component_config = `
      name: testcomponent
      `

      mock_fs({
        '/component.yml': component_config,
      });
      const manager = new LocalDependencyManager(axios.create(), {
        'test/component': '/component.yml',
      });
      let err;
      try {
        await manager.getGraph([
          await manager.loadComponentConfig('test/component'),
        ]);
      } catch (e) {
        err = e;
      }

      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message) as ValidationError[];
      expect(errors).lengthOf(1);
      expect(errors.map(e => e.path)).members([
        'name',
      ])
      expect(errors[0].message).includes('architect/component-name');
    });

    it('invalid component parameter keys', async () => {
      const component_config = `
      name: test/component
      parameters:
        test:
        test2: test
        test3: test
        test%%%%: test
        test***test:
          default: test
      `

      mock_fs({
        '/component.yml': component_config,
      });
      const manager = new LocalDependencyManager(axios.create(), {
        'test/component': '/component.yml',
      });
      let err;
      try {
        await manager.getGraph([
          await manager.loadComponentConfig('test/component'),
        ]);
      } catch (e) {
        err = e;
      }

      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message) as ValidationError[];
      expect(errors).lengthOf(2);
      expect(errors.map(e => e.path)).members([
        'parameters.test%%%%',
        'parameters.test***test'
      ])
      expect(errors[0].message).includes(Slugs.ComponentParameterDescription);
    });

    it('invalid component interfaces ref', async () => {
      const component_config = `
      name: test/component
      services:
        api:
          environment:
            OTHER_ADDR: \${{ dependencies.test/other.interfaces.fake.url }}
            EXT_OTHER_ADDR: \${{ dependencies.test/other.ingresses.fake.url }}
      dependencies:
        test/other: latest
      `
      const other_component_config = `
      name: test/other
      interfaces:
        not-fake: \${{ services.api.interfaces.main.url }}
      services:
        api:
          interfaces:
            main: 8080
      `

      mock_fs({
        '/component.yml': component_config,
        '/other-component.yml': other_component_config,
      });
      const manager = new LocalDependencyManager(axios.create(), {
        'test/component': '/component.yml',
        'test/other': '/other-component.yml'
      });
      let err;
      try {
        await manager.getGraph([
          await manager.loadComponentConfig('test/component'),
          await manager.loadComponentConfig('test/other')
        ]);
      } catch (e) {
        err = e;
      }

      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message) as ValidationError[];
      expect(errors).lengthOf(2);
      expect(errors.map(e => e.path)).members([
        'services.api.environment.OTHER_ADDR',
        'services.api.environment.EXT_OTHER_ADDR'
      ])
    });

    it('invalid services interfaces ref', async () => {
      const component_config = `
      name: test/component
      interfaces:
        other-api: \${{ services.other-api.interfaces.not-fake.url }}
      services:
        api:
          environment:
            OTHER_ADDR: \${{ services.other-api.interfaces.fake.url }}
            INT_OTHER_ADDR: \${{ interfaces.fake.url }}
            EXT_OTHER_ADDR: \${{ ingresses.fake.url }}
        other-api:
          interfaces:
            not-fake: 8080
      `

      mock_fs({
        '/component.yml': component_config,
      });
      const manager = new LocalDependencyManager(axios.create(), {
        'test/component': '/component.yml',
      });
      let err;
      try {
        await manager.getGraph([
          await manager.loadComponentConfig('test/component'),
        ]);
      } catch (e) {
        err = e;
      }
      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message) as ValidationError[];
      expect(errors).lengthOf(3);
      expect(errors.map(e => e.path)).members([
        'services.api.environment.OTHER_ADDR',
        'services.api.environment.INT_OTHER_ADDR',
        'services.api.environment.EXT_OTHER_ADDR'
      ])
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
      let err;
      try {
        await manager.getGraph([
          await manager.loadComponentConfig('test/component'),
        ]);
      } catch (e) {
        err = e;
      }
      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message) as ValidationError[];
      expect(errors).lengthOf(1);
      expect(errors.map(e => e.path)).members([
        "services.api.liveness_probe.path",
      ])
    });


    it('valid labels', async () => {
      const component_config = `
      name: test/component
      parameters:
        environment: dev
      services:
        app:
          labels:
            environment: dev
            environment2: \${{ parameters.environment }}
      `
      mock_fs({
        '/component.yml': component_config,
      });
      const manager = new LocalDependencyManager(axios.create(), {
        'test/component': '/component.yml',
      });
      let err;
      try {
        await manager.getGraph([
          await manager.loadComponentConfig('test/component'),
        ]);
      } catch (e) {
        err = e;
      }

      expect(err).to.be.undefined;
    });

    it('invalid labels', async () => {
      const component_config = `
      name: test/component
      parameters:
        environment: dev$%^%^%$T
      services:
        app:
          labels:
            environment: dev
            environment2: \${{ parameters.environment }}
            architect.io/Environment: dev
      `
      mock_fs({
        '/component.yml': component_config,
      });
      const manager = new LocalDependencyManager(axios.create(), {
        'test/component': '/component.yml',
      });

      let err;
      try {
        await manager.getGraph([
          await manager.loadComponentConfig('test/component'),
        ]);
      } catch (e) {
        err = e;
      }
      expect(err).instanceOf(ValidationErrors);
      const errors = JSON.parse(err.message);
      expect(errors).lengthOf(1);
      expect(err.message).includes(`services.app.labels.environment2`);
      expect(err.message).includes('must match pattern');
    });

    it('invalid labels length', async () => {
      const component_config = `
      name: test/component
      parameters:
        environment: dev$%^%^%$&T
      services:
        app:
          labels:
            architect.io.architect.io.architect.io.architect.io.architect.io.architect.io/architect.io: architect.io
      `
      mock_fs({
        '/component.yml': component_config,
      });
      const manager = new LocalDependencyManager(axios.create(), {
        'test/component': '/component.yml',
      });
      let err;
      try {
        await manager.getGraph([
          await manager.loadComponentConfig('test/component'),
        ]);
      } catch (e) {
        err = e;
      }
      expect(err).instanceOf(ValidationErrors);
      const errors = JSON.parse(err.message);
      expect(errors).lengthOf(1);
      expect(errors[0].message).eq('Invalid key: architect.io.architect.io.architect.io.architect.io.architect.io.architect.io/architect.io');
    });
  });

  describe('component builder validation', () => {
    it('file reference does not misalign validation error line numbers', async () => {
      const component_config = `
      name: test/component
      services:
        api:
          environment:
            TEST_FILE_TEXT: file:./test-file.txt
            OTHER_ADDR: \${{ dependencies.test/other.interfaces.fake.url }}
      dependencies:
        test/other: latest
      `

      const other_component_config = `
      name: test/other
      services:
        api:
          image: test
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
      let err;
      try {
        await manager.getGraph([
          await manager.loadComponentConfig('test/component'),
          await manager.loadComponentConfig('test/other')
        ]);
      } catch (e) {
        err = e;
      }
      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message) as ValidationError[];
      expect(errors).lengthOf(1);
      expect(errors.map(e => e.path)).members([
        'services.api.environment.OTHER_ADDR',
      ])

      /* TODO:288 line #s
      expect(err).instanceOf(ValidationErrors)
      expect(err.errors).to.deep.eq({
        "interpolation.dependencies.test/other.interfaces.fake.url": {
          "interpolation": "${{ dependencies.test/other.interfaces.fake.url }} is invalid",
          "value": "dependencies.test/other.interfaces.fake.url",
          "column": 24,
          "line": 9,
        }
      })
      */
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
        not-required2: false
      services:
        api:
          interfaces:
            main: 8080
          environment:
            REQUIRED: \${{ parameters.required }}
            REQUIRED_EXPLICIT: \${{ parameters.required-explicit }}
            NOT_REQUIRED: \${{ parameters.not-required }}
      `
      mock_fs({
        '/component.yml': component_config,
      });
      const manager = new LocalDependencyManager(axios.create(), {
        'test/component': '/component.yml',
      });
      let err;
      try {
        await manager.getGraph([
          await manager.loadComponentConfig('test/component'),
        ]);
      } catch (e) {
        err = e;
      }
      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message) as ValidationError[];
      expect(errors).lengthOf(2);
      expect(errors.map(e => e.path)).members([
        'test/component.parameters.required',
        'test/component.parameters.required-explicit',
      ])
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
      let err;
      try {
        const component_config = await manager.loadComponentConfig('examples/hello-world');
        await manager.getGraph([
          ...await manager.loadComponentConfigs(component_config),
        ]);
      } catch (e) {
        err = e;
      }
      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message) as ValidationError[];
      expect(errors).lengthOf(1);
      expect(errors.map(e => e.path)).members([
        'examples/hello-world2.parameters.aws_secret',
      ])
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
    } catch (e) { }
    expect(passed_validation).true;
  });

  it('invalid component keys in values files fail validation', () => {
    const values_dict = {
      "architect_cloud:latest": {
        "TEST": "string"
      }
    };

    let err;
    try {
      ValuesConfig.validate(values_dict)
    } catch (e) {
      err = e;
    }
    expect(err).instanceOf(ValidationErrors);
    const errors = JSON.parse(err.message);
    expect(errors).lengthOf(1);
    expect(errors[0].path).eq(`architect_cloud:latest`);
  });

  it('invalid value keys in values files fail validation', () => {
    const values_dict = {
      "architect/cloud:latest": {
        "TE@ST": "string"
      }
    };

    let err;
    try {
      ValuesConfig.validate(values_dict)
    } catch (e) {
      err = e;
    }
    expect(err).instanceOf(ValidationErrors);
    const errors = JSON.parse(err.message);
    expect(errors).lengthOf(1);
    expect(errors[0].path).eq(`architect/cloud:latest.TE@ST`);
  });

  it('component values are defined in an object', () => {
    const values_dict = {
      "architect/cloud:latest": [],
      "architect/cloud:*": 'string'
    };

    let err;
    try {
      ValuesConfig.validate(values_dict)
    } catch (e) {
      err = e;
    }
    expect(err).instanceOf(ValidationErrors);
    const errors = JSON.parse(err.message);
    expect(errors).lengthOf(2);
    expect(errors[0].path).eq(`architect/cloud:latest`);
    expect(errors[1].path).eq(`architect/cloud:*`);
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

    let err;
    try {
      ValuesConfig.validate(values_dict)
    } catch (e) {
      err = e;
    }
    expect(err).to.be.undefined;
  });

  it('AtLeastOne and scaling validation', async () => {
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
    let err;
    try {
      await manager.getGraph([
        await manager.loadComponentConfig('test/component'),
      ]);
    } catch (e) {
      err = e;
    }
    expect(err).instanceOf(ValidationErrors)
    const errors = JSON.parse(err.message) as ValidationError[];
    expect(errors).lengthOf(1);
    expect(errors.map(e => e.path)).members([
      'services.api.scaling.metrics',
    ])
  })
});
