import { test } from '@oclif/test';
import { expect } from 'chai';
import { plainToClass } from 'class-transformer';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import sinon from 'sinon';
import { ComponentConfigV1 } from '../../src/dependency-manager/src/component-config/v1';
import { mockAuth } from '../utils/mocks';

describe('convert', function () {

  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = true; // TODO: restore

  // we need to cast this as a string because annoyingly the oclif/fancy-test library has restricted this type to a string
  // while the underyling nock library that it wraps allows a regex
  // submitted an issue here: https://github.com/oclif/fancy-test/issues/73
  const mock_api_host = (/.*/ as any as string);

  let writeFileStub: sinon.SinonStub;

  const mock_account_response = {
    created_at: "2020-06-02T15:33:27.870Z",
    updated_at: "2020-06-02T15:33:27.870Z",
    deleted_at: null,
    id: "ba440d39-97d9-43c3-9f1a-a9a69adb2a41",
    name: "examples",
    display_name: null,
    description: "",
    location: null,
    website: null,
    is_public: false,
    default_user_id: null
  }

  const mock_architect_account_response = {
    ...mock_account_response,
    name: 'architect'
  }

  test
    .do(ctx => mockAuth())
    .finally(() => sinon.restore())
    .stdout({ print })
    .stderr({ print })
    .command(['convert', '--help'])
    .it('succinctly describes the convert command', ctx => {
      expect(ctx.stdout).to.contain('Initialize an architect component from an existing docker-compose file\n')
    });

    test
    .do(ctx => {
      mockAuth();
      writeFileStub = sinon.stub(fs, "writeFileSync");
    })
    .finally(() => sinon.restore())
    .stdout({ print })
    .stderr({ print })
    .command(['convert', path.join(__dirname, '../mocks/convert-compose.yml'), '-a', 'examples', '-n', 'test-component'])
    .it('converts a docker-compose file to an architect component file', ctx => {
      expect(writeFileStub.called).to.be.true;

      expect(ctx.stdout).to.contain('Wrote Architect component config to architect.yml');
      expect(ctx.stdout).to.contain('The component config may be incomplete and should be checked for consistency with the context of your application. Helpful reference docs can be found at https://www.architect.io/docs/reference/component-spec.');
    });

    test
    .do(ctx => {
      mockAuth();
      writeFileStub = sinon.stub(fs, "writeFileSync");
    })
    .finally(() => sinon.restore())
    .stdout({ print })
    .stderr({ print })
    .command(['convert', path.join(__dirname, '../mocks/convert-compose.yml'), '-a', 'examples', '-n', 'test-component', '-o', 'test-directory/architect.yml'])
    .it('converts a docker-compose file to an architect component file and writes the file to a specified output', ctx => {
      expect(writeFileStub.called).to.be.true;

      expect(writeFileStub.args[0][0]).eq('test-directory/architect.yml');
      expect(ctx.stdout).to.contain('Wrote Architect component config to test-directory/architect.yml');
      expect(ctx.stdout).to.contain('The component config may be incomplete and should be checked for consistency with the context of your application. Helpful reference docs can be found at https://www.architect.io/docs/reference/component-spec.');
    });

    test
    .do(ctx => {
      mockAuth();
      writeFileStub = sinon.stub(fs, "writeFileSync");
    })
    .finally(() => sinon.restore())
    .stdout({ print })
    .stderr({ print })
    .command(['convert', path.join(__dirname, '../mocks/convert-compose.yml'), '-a', 'examples', '-n', 'test-component'])
    .it('names the component based on the input args', ctx => {
      expect(writeFileStub.called).to.be.true;

      const component_config = plainToClass(ComponentConfigV1, yaml.safeLoad(writeFileStub.args[0][1]));
      expect(component_config.name).eq('examples/test-component');
    });

    test
    .do(ctx => {
      mockAuth();
      writeFileStub = sinon.stub(fs, "writeFileSync");
    })
    .finally(() => sinon.restore())
    .stdout({ print })
    .stderr({ print })
    .command(['convert', path.join(__dirname, '../mocks/convert-compose.yml'), '-a', 'examples', '-n', 'test-component'])
    .it('converts all services from the docker compose file to architect services', ctx => {
      expect(writeFileStub.called).to.be.true;

      const component_config = plainToClass(ComponentConfigV1, yaml.safeLoad(writeFileStub.args[0][1]));
      expect(Object.keys(component_config.services || {})).to.deep.equal(['elasticsearch', 'logstash','kibana']);
    });

    test
    .do(ctx => {
      mockAuth();
      writeFileStub = sinon.stub(fs, "writeFileSync");
    })
    .finally(() => sinon.restore())
    .stdout({ print })
    .stderr({ print })
    .command(['convert', path.join(__dirname, '../mocks/convert-compose.yml'), '-a', 'examples', '-n', 'test-component'])
    .it('adds initial descriptions to each service', ctx => {
      expect(writeFileStub.called).to.be.true;

      const component_config = plainToClass(ComponentConfigV1, yaml.safeLoad(writeFileStub.args[0][1]));
      expect(component_config.getServices()['elasticsearch'].getDescription()).eq('elasticsearch converted to an Architect service with "architect convert"');
      expect(component_config.getServices()['kibana'].getDescription()).eq('kibana converted to an Architect service with "architect convert"');
      expect(component_config.getServices()['logstash'].getDescription()).eq('logstash converted to an Architect service with "architect convert"');
    });
});
