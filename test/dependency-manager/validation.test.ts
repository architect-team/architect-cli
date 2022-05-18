import axios from 'axios';
import { expect } from 'chai';
import yaml from 'js-yaml';
import mock_fs from 'mock-fs';
import nock from 'nock';
import { buildSpecFromPath, buildSpecFromYml, resourceRefToNodeRef, Slugs, ValidationError, ValidationErrors } from '../../src';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { SecretsConfig } from '../../src/dependency-manager/secrets/secrets';

describe('validate spec', () => {

  describe('component config validation', () => {
    it('valid service ref brackets', async () => {
      const component_config = `
      name: component
      services:
        stateless-app:
          interfaces:
            main: 8080
      interfaces:
        frontend: \${{ services['stateless-app'].interfaces.main.url }}
      `
      mock_fs({ '/architect.yml': component_config });
      buildSpecFromPath('/architect.yml')
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
        buildSpecFromPath('/architect.yml')
      } catch (e: any) {
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
      const manager = new LocalDependencyManager(axios.create(), {
        'test/component': '/architect.yml',
      });
      let err;
      try {
        await manager.getGraph([
          await manager.loadComponentSpec('test/component'),
        ]);
      } catch (e: any) {
        err = e;
      }

      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message);
      expect(errors).lengthOf(1);
      expect(errors[0].path).eq(`services.stateless-app.replicas`);
      expect(errors[0].message).includes(`must be number or must be an interpolation`);
      expect(errors[0].start?.row).eq(5);
      expect(errors[0].start?.column).eq(22);
      expect(errors[0].end?.row).eq(5);
      expect(errors[0].end?.column).eq(22);
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
      const manager = new LocalDependencyManager(axios.create(), {
        'test/component': '/architect.yml',
      });
      let err;
      try {
        await manager.getGraph([
          await manager.loadComponentSpec('test/component'),
        ]);
      } catch (e: any) {
        err = e;
      }

      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message);
      expect(errors).lengthOf(1);
      expect(errors[0].message).includes(`services.stateless-app.interfaces.main.url`);
      expect(errors[0].path).eq(`interfaces.frontend`);
    });

    it('services and tasks can share the same name', async () => {
      const component_config = `
      name: component
      services:
        app:
          environment:
            TEST: 1
      tasks:
        app:
          environment:
            TEST: 1
      `
      mock_fs({ '/architect.yml': component_config });
      const manager = new LocalDependencyManager(axios.create(), {
        'component': '/architect.yml',
      });

      const graph = await manager.getGraph([
        await manager.loadComponentSpec('component'),
      ]);
      expect(graph.nodes).to.have.lengthOf(2)
      expect(graph.nodes.map((node) => node.ref)).to.have.members([
        resourceRefToNodeRef('component.services.app'),
        resourceRefToNodeRef('component.tasks.app')
      ])
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
      buildSpecFromPath('/architect.yml')
    });

    it('invalid task schedule', async () => {
      const component_config = `
      name: test/component
      tasks:
        some-task:
          schedule: "*/5 * * * ? * * * * *"
          image: ellerbrock/alpine-bash-curl-ssl
      `
      mock_fs({ '/architect.yml': component_config });
      const manager = new LocalDependencyManager(axios.create(), {
        'test/component': '/architect.yml',
      });
      let err;
      try {
        await manager.getGraph([
          await manager.loadComponentSpec('test/component'),
        ]);
      } catch (e: any) {
        err = e;
      }
      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message);
      expect(errors).lengthOf(1);
      expect(errors[0].path).eq(`tasks.some-task.schedule`);
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
      buildSpecFromPath('/architect.yml')
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
      const manager = new LocalDependencyManager(axios.create(), {
        'test/component': '/architect.yml',
      });
      let err;
      try {
        await manager.getGraph([
          await manager.loadComponentSpec('test/component'),
        ]);
      } catch (e: any) {
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
      const manager = new LocalDependencyManager(axios.create(), {
        'test/component': '/architect.yml',
      });
      let err;
      try {
        await manager.getGraph([
          await manager.loadComponentSpec('test/component'),
        ]);
      } catch (e: any) {
        err = e;
      }
      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message);
      expect(errors).lengthOf(1);
      expect(errors[0].path).eq(`services.stateless-app.depends_on`);
    });

    it('invalid service depends_on reference', async () => {
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
      const manager = new LocalDependencyManager(axios.create(), {
        'test/component': '/architect.yml',
      });
      let err;
      try {
        await manager.getGraph([
          await manager.loadComponentSpec('test/component'),
        ]);
      } catch (e: any) {
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

      const manager = new LocalDependencyManager(axios.create(), {
        'test/component': '/architect.yml',
      });
      let err;
      try {
        await manager.getGraph([
          await manager.loadComponentSpec('test/component'),
        ]);
      } catch (e: any) {
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
      const manager = new LocalDependencyManager(axios.create(), {
        'test/component': '/architect.yml',
      });
      let err;
      try {
        await manager.getGraph([
          await manager.loadComponentSpec('test/component'),
        ]);
      } catch (e: any) {
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
      name: test_component
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
          await manager.loadComponentSpec('test/component'),
        ]);
      } catch (e: any) {
        err = e;
      }

      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message) as ValidationError[];
      expect(errors).lengthOf(1);
      expect(errors.map(e => e.path)).members([
        'name',
      ])
      expect(errors[0].message).includes('architect/component-name');
      expect(errors[0].component).eq('test_component');
      expect(errors[0].start?.row).eq(2);
      expect(errors[0].start?.column).eq(12);
      expect(errors[0].end?.row).eq(2);
      expect(errors[0].end?.column).eq(26);
    });

    it('invalid key value', async () => {
      const component_config = `
      name: test/component
      secrets:
        environment: missing if
      services:
        app:
          \${{ secrets.environment == 'local' }}:
            environment:
              TEST: 1
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
          await manager.loadComponentSpec('test/component'),
        ]);
      } catch (e: any) {
        err = e;
      }

      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message) as ValidationError[];
      expect(errors).lengthOf(1);
      expect(errors.map(e => e.path)).members([
        `services.app.\${{ secrets.environment == 'local' }}`,
      ])
      expect(errors[0].invalid_key).is.true;
      expect(errors[0].start?.row).eq(7);
      expect(errors[0].start?.column).eq(11);
      expect(errors[0].end?.row).eq(7);
      expect(errors[0].end?.column).eq(48);
    });

    it('invalid component secret keys', async () => {
      const component_config = `
      name: test/component
      secrets:
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
          await manager.loadComponentSpec('test/component'),
        ]);
      } catch (e: any) {
        err = e;
      }

      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message) as ValidationError[];
      expect(errors).lengthOf(2);
      expect(errors.map(e => e.path)).members([
        'secrets.test%%%%',
        'secrets.test***test'
      ])
      expect(errors[0].message).includes(Slugs.ComponentSecretDescription);
    });

    it('invalid secret ref', async () => {
      const component_config = `
      name: test/component
      secrets:
        test: test2
      services:
        api:
          environment:
            TEST: \${{ secret.test }}
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
          await manager.loadComponentSpec('test/component'),
        ]);
      } catch (e: any) {
        err = e;
      }

      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message) as ValidationError[];
      expect(errors).lengthOf(1);

      expect(errors.map(e => e.path)).members([
        'services.api.environment.TEST',
      ])
      expect(errors[0].message).includes('secrets.test');
      expect(errors[0].component).eq('test/component');
      expect(errors[0].start?.row).eq(8);
      expect(errors[0].start?.column).eq(23);
      expect(errors[0].end?.row).eq(8);
      expect(errors[0].end?.column).eq(33);
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
          await manager.loadComponentSpec('test/component'),
          await manager.loadComponentSpec('test/other')
        ]);
      } catch (e: any) {
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
          await manager.loadComponentSpec('test/component'),
        ]);
      } catch (e: any) {
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

    it('invalid services ref', async () => {
      const component_config = `
      name: test/component
      interfaces:
        api: \${{ services.app.interfaces.main.url }}
        api2: \${{ service.api.interfaces.main.url }}
      services:
        api:
          interfaces:
            main: 8080
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
          await manager.loadComponentSpec('test/component', { interfaces: { api: 'api', api2: 'api2' } }),
        ]);
      } catch (e: any) {
        err = e;
      }
      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message) as ValidationError[];
      expect(errors).lengthOf(2);
      expect(errors.map(e => e.path)).members([
        'interfaces.api.url',
        'interfaces.api2.url'
      ])
      expect(errors[0].message).includes('services.api.interfaces.main.url')
      expect(errors[1].message).includes('services.api.interfaces.main.url')
    });

    it('deploy time validation', async () => {
      const component_config = `
      name: test/component
      secrets:
        app_liveness_path: /health
      services:
        app:
          liveness_probe:
            path: \${{ secrets.app_liveness_path }}
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
          await manager.loadComponentSpec('test/component'),
        ]);
      } catch (e: any) {
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
      secrets:
        environment: dev
      services:
        app:
          labels:
            environment: dev
            environment2: \${{ secrets.environment }}
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
          await manager.loadComponentSpec('test/component'),
        ]);
      } catch (e: any) {
        err = e;
      }

      expect(err).to.be.undefined;
    });

    it('invalid labels', async () => {
      const component_config = `
      name: test/component
      secrets:
        environment: dev$%^%^%$T
      services:
        app:
          labels:
            environment: dev
            environment2: \${{ secrets.environment }}
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
          await manager.loadComponentSpec('test/component'),
        ]);
      } catch (e: any) {
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
      secrets:
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
          await manager.loadComponentSpec('test/component'),
        ]);
      } catch (e: any) {
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
          await manager.loadComponentSpec('test/component'),
          await manager.loadComponentSpec('test/other')
        ]);
      } catch (e: any) {
        err = e;
      }
      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message) as ValidationError[];
      expect(errors).lengthOf(1);
      expect(errors.map(e => e.path)).members([
        'services.api.environment.OTHER_ADDR',
      ])
      expect(errors[0].start).to.deep.equal({
        row: 7,
        column: 29
      })
      expect(errors[0].end).to.deep.equal({
        row: 7,
        column: 71
      })
    });
  });

  describe('required secret validation', () => {
    it('required component secrets', async () => {
      const component_config = `
      name: test/component
      secrets:
        required:
        required-explicit:
          required: true
        required-implicit:
          description: Implicit require
        not-required:
          required: false
        not-required2: false
      services:
        api:
          interfaces:
            main: 8080
          environment:
            REQUIRED: \${{ secrets.required }}
            REQUIRED_IMPLICIT: \${{ secrets.required-implicit }}
            REQUIRED_EXPLICIT: \${{ secrets.required-explicit }}
            NOT_REQUIRED: \${{ secrets.not-required }}
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
          await manager.loadComponentSpec('test/component'),
        ]);
      } catch (e: any) {
        err = e;
      }
      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message) as ValidationError[];
      expect(errors).lengthOf(3);
      expect(errors.map(e => e.path)).members([
        'secrets.required',
        'secrets.required-implicit',
        'secrets.required-explicit',
      ])
      expect([...new Set(errors.map(e => e.component))]).members([
        'test/component',
      ])
    });

    it('required dependency secret', async () => {
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

      secrets:
        aws_secret:

      services:
        api:
          image: heroku/nodejs-hello-world
          interfaces:
            main: 3000
          environment:
            AWS_SECRET: \${{ secrets.aws_secret }}

      interfaces:
        echo:
          url: \${{ services.api.interfaces.main.url }}
      `

      mock_fs({
        '/architect.yml': component_config,
      });

      nock('http://localhost').get('/accounts/examples/components/hello-world2/versions/latest')
        .reply(200, { tag: 'latest', config: yaml.load(component_config2), service: { url: 'examples/hello-world2:latest' } });

      const manager = new LocalDependencyManager(axios.create(), {
        'examples/hello-world': '/architect.yml',
      });
      let err;
      try {
        await manager.getGraph([
          ...await manager.loadComponentSpecs('examples/hello-world'),
        ]);
      } catch (e: any) {
        err = e;
      }
      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message) as ValidationError[];
      expect(errors).lengthOf(1);
      expect(errors.map(e => e.path)).members([
        'secrets.aws_secret',
      ])
      expect([...new Set(errors.map(e => e.component))]).members([
        'examples/hello-world2',
      ])
    });
  });

  it('valid component keys in values files pass validation', () => {
    const values_dict = {
      "*": {
        "POSTGRES_HOST": "172.17.0.1"
      },
      "architect/cloud": {
        "TEST": "string"
      }

    };

    let passed_validation = false;
    try {
      SecretsConfig.validate(values_dict)
      passed_validation = true;
    } catch (e: any) { }
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
      SecretsConfig.validate(values_dict)
    } catch (e: any) {
      err = e;
    }
    expect(err).instanceOf(ValidationErrors);
    const errors = JSON.parse(err.message);
    expect(errors).lengthOf(1);
    expect(errors[0].path).eq(`architect_cloud:latest`);
  });

  it('invalid value keys in values files fail validation', () => {
    const values_dict = {
      "architect/cloud": {
        "TE@ST": "string"
      }
    };

    let err;
    try {
      SecretsConfig.validate(values_dict)
    } catch (e: any) {
      err = e;
    }
    expect(err).instanceOf(ValidationErrors);
    const errors = JSON.parse(err.message);
    expect(errors).lengthOf(1);
    expect(errors[0].path).eq(`architect/cloud.TE@ST`);
  });

  it('component values are defined in an object', () => {
    const values_dict = {
      "architect/cloud": [],
      "architect/cloud@v2": 'string'
    };

    let err;
    try {
      SecretsConfig.validate(values_dict as any)
    } catch (e: any) {
      err = e;
    }
    expect(err).instanceOf(ValidationErrors);
    const errors = JSON.parse(err.message);
    expect(errors).lengthOf(2);
    expect(errors[0].path).eq(`architect/cloud`);
    expect(errors[1].path).eq(`architect/cloud@v2`);
  });

  it('component values are strings only', () => {
    const values_dict = {
      "architect/cloud": {
        'test': 'test value'
      },
      "architect/cloud@v2": {
        'ANOTHER_test': 'another value'
      },
      "architect/*": {
        'ANOTHER_test': 'another value'
      }
    };

    let err;
    try {
      SecretsConfig.validate(values_dict)
    } catch (e: any) {
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
        await manager.loadComponentSpec('test/component'),
      ]);
    } catch (e: any) {
      err = e;
    }
    expect(err).instanceOf(ValidationErrors)
    const errors = JSON.parse(err.message) as ValidationError[];
    expect(errors).lengthOf(1);
    expect(errors.map(e => e.path)).members([
      'services.api.scaling.metrics',
    ])
  })

  it('valid interface number', async () => {
    const component_config = `
      name: test/component
      services:
        app:
          interfaces:
            main: 3000
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
        await manager.loadComponentSpec('test/component'),
      ]);
    } catch (e: any) {
      err = e;
    }

    expect(err).to.be.undefined;
  });

  it('invalid interface string', async () => {
    const component_config = `
      name: test/component
      services:
        app:
          interfaces:
            main: "3000"
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
        await manager.loadComponentSpec('test/component'),
      ]);
    } catch (e: any) {
      err = e;
    }
    expect(err).instanceOf(ValidationErrors);
    const errors = JSON.parse(err.message);
    expect(errors).lengthOf(1);
    expect(err.message).includes(`services.app.interfaces`);
    expect(err.message).includes('or must be an interpolation ref ex. ${{ secrets.example }}');
    expect(err.message).includes('or must be number');
    expect(err.message).includes('or must be object');
  });

  it('valid interface interpolation reference', async () => {
    const component_config = `
      name: test/component
      secrets:
        app_port: 3000
      services:
        app:
          interfaces:
            main: \${{ secrets.app_port }}
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
        await manager.loadComponentSpec('test/component'),
      ]);
    } catch (e: any) {
      err = e;
    }

    expect(err).to.be.undefined;
  });

  it('invalid interface string', async () => {
    const component_config = `
      name: test/component
      services:
        app:
          interfaces:
            main: "3000"
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
        await manager.loadComponentSpec('test/component'),
      ]);
    } catch (e: any) {
      err = e;
    }
    expect(err).instanceOf(ValidationErrors);
    const errors = JSON.parse(err.message);
    expect(errors).lengthOf(1);
    expect(err.message).includes(`services.app.interfaces`);
    expect(err.message).includes('or must be an interpolation ref ex. ${{ secrets.example }}');
    expect(err.message).includes('or must be number');
    expect(err.message).includes('or must be object');
  });

  it('valid component interface string', async () => {
    const component_config = `
      name: test/component
      interfaces:
        main: \${{ services.app.interfaces.main.url }}
      services:
        app:
          interfaces:
            main: 3000
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
        await manager.loadComponentSpec('test/component'),
      ]);
    } catch (e: any) {
      err = e;
    }
    expect(err).to.be.undefined;
  });

  it('invalid component interface number', async () => {
    const component_config = `
      name: test/component
      interfaces:
        main: 3000
      services:
        app:
          interfaces:
            main: 3000
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
        await manager.loadComponentSpec('test/component'),
      ]);
    } catch (e: any) {
      err = e;
    }
    expect(err).instanceOf(ValidationErrors);
    const errors = JSON.parse(err.message);
    expect(errors).lengthOf(1);
    expect(err.message).includes(`interfaces.main`);
    expect(err.message).includes('must be object');
    expect(err.message).includes('must be string');
  });

  it('invalid component interface number', async () => {
    const component_config = `
      name: test/component
      interfaces: main
      services:
        app:
          interfaces:
            main: 3000
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
        await manager.loadComponentSpec('test/component'),
      ]);
    } catch (e: any) {
      err = e;
    }
    expect(err).instanceOf(ValidationErrors);
    const errors = JSON.parse(err.message);
    expect(errors).lengthOf(1);
    expect(err.message).includes(`interfaces`);
    expect(err.message).includes('must be object');
  });

  it('valid command', async () => {
    const component_config = `
      name: test/component
      secrets:
        SPRING_PROFILE: test
      services:
        app:
          command: catalina.sh run -Pprofile=\${{ secrets.SPRING_PROFILE }}
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
        await manager.loadComponentSpec('test/component'),
      ]);
    } catch (e: any) {
      err = e;
    }
    expect(err).to.be.undefined;
  });

  it('liveness_probe rejects command with path', async () => {
    const component_config = `
      name: test/component
      services:
        api:
          interfaces:
            main: 8080
          liveness_probe:
            command:
              - /bin/bash
              - health.sh
            path: /test
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
        await manager.loadComponentSpec('test/component'),
      ]);
    } catch (e: any) {
      err = e;
    }
    expect(err).instanceOf(ValidationErrors)
    const errors = JSON.parse(err.message) as ValidationError[];
    expect(errors).lengthOf(1);
    expect(errors.map(e => e.path)).members([
      'services.api.liveness_probe',
    ])
  })

  it('liveness_probe rejects command with port', async () => {
    const component_config = `
      name: test/component
      services:
        api:
          interfaces:
            main: 8080
          liveness_probe:
            command:
              - /bin/bash
              - health.sh
            port: 3000
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
        await manager.loadComponentSpec('test/component'),
      ]);
    } catch (e: any) {
      err = e;
    }
    expect(err).instanceOf(ValidationErrors)
    const errors = JSON.parse(err.message) as ValidationError[];
    expect(errors).lengthOf(1);
    expect(errors.map(e => e.path)).members([
      'services.api.liveness_probe',
    ]);
  })

  it('liveness_probe accepts command', async () => {
    const component_config = `
      name: test/component
      services:
        api:
          interfaces:
            main: 8080
          liveness_probe:
            command:
              - /bin/bash
              - health.sh
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
        await manager.loadComponentSpec('test/component'),
      ]);
    } catch (e: any) {
      err = e;
    }

    expect(err).to.be.undefined;
  })

  it('liveness_probe accepts port and path', async () => {
    const component_config = `
      name: test/component
      services:
        api:
          interfaces:
            main: 8080
          liveness_probe:
            port: 8080
            path: /health
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
        await manager.loadComponentSpec('test/component'),
      ]);
    } catch (e: any) {
      err = e;
    }

    expect(err).to.be.undefined;
  })

  it('liveness_probe rejects port without path', async () => {
    const component_config = `
      name: test/component
      services:
        api:
          interfaces:
            main: 8080
          liveness_probe:
            port: 3000
      `;
    mock_fs({
      '/component.yml': component_config,
    });
    const manager = new LocalDependencyManager(axios.create(), {
      'test/component': '/component.yml',
    });
    let err;
    try {
      await manager.getGraph([
        await manager.loadComponentSpec('test/component'),
      ]);
    } catch (e: any) {
      err = e;
    }

    expect(err).instanceOf(ValidationErrors)
    const errors = JSON.parse(err.message) as ValidationError[];
    expect(errors).lengthOf(1);
    expect(errors.map(e => e.path)).members([
      'services.api.liveness_probe',
    ]);
    expect(errors.map(e => e.message)).members([
      `must have required property 'command' or must have required property 'path' or must match exactly one schema in oneOf`,
    ]);
  })

  it('liveness_probe rejects path without port', async () => {
    const component_config = `
      name: test/component
      services:
        api:
          interfaces:
            main: 8080
          liveness_probe:
            path: /health
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
        await manager.loadComponentSpec('test/component'),
      ]);
    } catch (e: any) {
      err = e;
    }

    expect(err).instanceOf(ValidationErrors)
    const errors = JSON.parse(err.message) as ValidationError[];
    expect(errors).lengthOf(1);
    expect(errors.map(e => e.path)).members([
      'services.api.liveness_probe',
    ]);
    expect(errors.map(e => e.message)).members([
      `must have required property 'command' or must have required property 'port' or must match exactly one schema in oneOf`,
    ]);
  })

  it('throw error for trying to expose incorrect interface', async () => {
    const yml = `
    name: test/component
    services:
      app:
        interfaces:
          main: 8080
    interfaces:
      app: \${{ services.app.interfaces.main.url }}
    `

    mock_fs({
      '/stack/architect.yml': yml,
    });

    const manager = new LocalDependencyManager(axios.create(), {
      'test/component': '/stack/architect.yml',
    });

    let err;
    try {
      await manager.getGraph([
        await manager.loadComponentSpec('test/component', { interfaces: { 'cloud': 'appppp' } }),
      ]);
    } catch (e: any) {
      err = e;
    }

    expect(err).instanceOf(ValidationErrors)
    const errors = JSON.parse(err.message) as ValidationError[];
    expect(errors).lengthOf(1);
    expect(errors.map(e => e.path)).members([
      'interfaces.appppp',
    ]);
    expect(errors[0].message).to.include('interfaces.app')
  });

  describe('validate if statements', () => {
    it('cannot use if statement at top level of component', async () => {
      const yml = `
      name: test/component
      \${{ if true }}:
        secrets:
          test: test
      `

      let err;
      try {
        buildSpecFromYml(yml);
      } catch (e: any) {
        err = e;
      }

      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message) as ValidationError[];
      expect(errors).lengthOf(1);
      expect(errors.map(e => e.path)).members([
        '${{ if true }}',
      ]);
    })

    it('cannot use if statement in secrets block', async () => {
      const yml = `
      name: test/component
      secrets:
        \${{ if true }}:
          test: test
      `

      let err;
      try {
        buildSpecFromYml(yml);
      } catch (e: any) {
        err = e;
      }

      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message) as ValidationError[];
      expect(errors).lengthOf(1);
      expect(errors.map(e => e.path)).members([
        'secrets.${{ if true }}',
      ]);
    })

    it('cannot use if statement in secret value block', async () => {
      const yml = `
      name: test/component
      secrets:
        test:
          \${{ if true }}:
            default: test
      `

      let err;
      try {
        buildSpecFromYml(yml);
      } catch (e: any) {
        err = e;
      }

      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message) as ValidationError[];
      expect(errors).lengthOf(1);
      expect(errors.map(e => e.path)).members([
        'secrets.test.${{ if true }}',
      ]);
    })

    it('cannot use if statement in dependencies block', async () => {
      const yml = `
      name: test/component
      dependencies:
        \${{ if true }}:
          test/dependency: latest
      `

      let err;
      try {
        buildSpecFromYml(yml);
      } catch (e: any) {
        err = e;
      }

      expect(err).instanceOf(ValidationErrors)
      const errors = JSON.parse(err.message) as ValidationError[];
      expect(errors).lengthOf(1);
      expect(errors.map(e => e.path)).members([
        'dependencies.${{ if true }}',
      ]);
    })

    it('can use if statement in service block', async () => {
      const yml = `
      name: test/component
      services:
        app:
          environment:
            TEST: 1
          \${{ if true }}:
            environment:
              TEST2: 2
      `
      buildSpecFromYml(yml);
    })
  })
});
