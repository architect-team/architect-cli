import { test } from '@oclif/test';
import { expect } from 'chai';
import { plainToClass } from 'class-transformer';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import sinon from 'sinon';
import { ComponentConfigV1 } from '../../src/dependency-manager/src/component-config/v1';
import { BuildSpecV1 } from '../../src/dependency-manager/src/service-config/v1';
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
      expect(Object.keys(component_config.services || {})).deep.equal(['elasticsearch', 'logstash','kibana']);
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

    test
    .do(ctx => {
      mockAuth();
      writeFileStub = sinon.stub(fs, "writeFileSync");
    })
    .finally(() => sinon.restore())
    .stdout({ print })
    .stderr({ print })
    .command(['convert', path.join(__dirname, '../mocks/convert-compose.yml'), '-a', 'examples', '-n', 'test-component'])
    .it('adds environment variables to each service', ctx => {
      expect(writeFileStub.called).to.be.true;

      const component_config = plainToClass(ComponentConfigV1, yaml.safeLoad(writeFileStub.args[0][1]));
      expect(component_config.getServices()['elasticsearch'].getEnvironmentVariables()['ES_JAVA_OPTS']).eq('-Xmx256m -Xms256m');
      expect(component_config.getServices()['elasticsearch'].getEnvironmentVariables()['ELASTIC_PASSWORD']).eq('changeme');
      expect(component_config.getServices()['elasticsearch'].getEnvironmentVariables()['discovery.type']).eq('single-node');
      expect(component_config.getServices()['elasticsearch'].getEnvironmentVariables()['TEST_NUMBER']).eq('3000');
      expect(component_config.getServices()['logstash'].getEnvironmentVariables()['LS_JAVA_OPTS']).eq('-Xmx256m -Xms256m');
      expect(component_config.getServices()['logstash'].getEnvironmentVariables()['ELASTICSEARCH_URL']).eq('${{ services.elasticsearch.interfaces.interface0.url }}');
      expect(component_config.getServices()['kibana'].getEnvironmentVariables()['ELASTICSEARCH_URL']).eq('${{ services.elasticsearch.interfaces.interface0.url }}');
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
    .it('adds command to logstash service', ctx => {
      expect(writeFileStub.called).to.be.true;

      const component_config = plainToClass(ComponentConfigV1, yaml.safeLoad(writeFileStub.args[0][1]));
      expect(component_config.getServices()['logstash'].getCommand()).deep.eq(['npm', 'run', 'start']);
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
    .it('adds entrypoint to logstash service', ctx => {
      expect(writeFileStub.called).to.be.true;

      const component_config = plainToClass(ComponentConfigV1, yaml.safeLoad(writeFileStub.args[0][1]));
      expect(component_config.getServices()['logstash'].getEntrypoint()).deep.eq(['entrypoint.sh']);
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
    .it('adds image to kibana service', ctx => {
      expect(writeFileStub.called).to.be.true;

      const component_config = plainToClass(ComponentConfigV1, yaml.safeLoad(writeFileStub.args[0][1]));
      expect(component_config.getServices()['kibana'].getImage()).eq('docker.elastic.co/kibana/kibana:7.8.0');
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
    .it('adds build context and args to elasticsearch service', ctx => {
      expect(writeFileStub.called).to.be.true;

      const component_config = plainToClass(ComponentConfigV1, yaml.safeLoad(writeFileStub.args[0][1]));
      expect((component_config.getServices()['elasticsearch'].getBuild() as BuildSpecV1).args!['ELK_VERSION']).eq('$ELK_VERSION');
      expect((component_config.getServices()['elasticsearch'].getBuild() as BuildSpecV1).context).eq('elasticsearch/');
      expect((component_config.getServices()['elasticsearch'].getBuild() as BuildSpecV1).dockerfile).eq('Dockerfile.elasticsearch');
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
    .it('adds ports of various docker-compose types to kibana component config', ctx => {
      expect(writeFileStub.called).to.be.true;

      const component_config = plainToClass(ComponentConfigV1, yaml.safeLoad(writeFileStub.args[0][1]));
      console.log(JSON.stringify(component_config.getServices()['kibana'].getInterfaces(), null, 2))
      expect(component_config.getServices()['kibana'].getInterfaces()['interface0'].port).eq('5601');
      expect(component_config.getServices()['kibana'].getInterfaces()['interface1'].port).eq('5000');
      expect(component_config.getServices()['kibana'].getInterfaces()['interface1'].protocol).eq('udp');
      expect(component_config.getServices()['kibana'].getInterfaces()['interface2'].port).eq('8001');
      expect(component_config.getServices()['kibana'].getInterfaces()['interface3'].port).eq('3000');
      expect(component_config.getServices()['kibana'].getInterfaces()['interface4'].port).eq('4000');
      expect(component_config.getServices()['kibana'].getInterfaces()['interface9'].port).eq('4005');
      expect(component_config.getServices()['kibana'].getInterfaces()['interface10'].port).eq('1240');
      expect(component_config.getServices()['kibana'].getInterfaces()['interface11'].port).eq('8080');
      expect(component_config.getServices()['kibana'].getInterfaces()['interface12'].port).eq('8081');
      expect(component_config.getServices()['kibana'].getInterfaces()['interface13'].port).eq('5000');
      expect(component_config.getServices()['kibana'].getInterfaces()['interface23'].port).eq('5010');
      expect(component_config.getServices()['kibana'].getInterfaces()['interface24'].port).eq('4444');
      expect(component_config.getServices()['kibana'].getInterfaces()['interface24'].protocol).eq('tcp');
      expect(component_config.getServices()['kibana'].getInterfaces()['interface25'].port).eq('4445');
      expect(component_config.getServices()['kibana'].getInterfaces()['interface25'].protocol).eq('udp');
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
    .it('adds ports to elasticsearch component config', ctx => {
      expect(writeFileStub.called).to.be.true;

      const component_config = plainToClass(ComponentConfigV1, yaml.safeLoad(writeFileStub.args[0][1]));
      console.log(JSON.stringify(component_config.getServices()['elasticsearch'].getInterfaces(), null, 2))
      expect(component_config.getServices()['elasticsearch'].getInterfaces()['interface0'].port).eq('9200');
      expect(component_config.getServices()['elasticsearch'].getInterfaces()['interface1'].port).eq('9300');
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
    .it('adds ports to logstash component config', ctx => {
      expect(writeFileStub.called).to.be.true;

      const component_config = plainToClass(ComponentConfigV1, yaml.safeLoad(writeFileStub.args[0][1]));
      console.log(JSON.stringify(component_config.getServices()['logstash'].getInterfaces(), null, 2))
      expect(component_config.getServices()['logstash'].getInterfaces()['interface0'].port).eq('5000');
      expect(component_config.getServices()['logstash'].getInterfaces()['interface0'].protocol).eq('tcp');
      expect(component_config.getServices()['logstash'].getInterfaces()['interface1'].port).eq('5000');
      expect(component_config.getServices()['logstash'].getInterfaces()['interface1'].protocol).eq('udp');
      expect(component_config.getServices()['logstash'].getInterfaces()['interface2'].port).eq('9600');
    });


});
