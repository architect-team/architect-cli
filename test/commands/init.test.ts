import { expect } from 'chai';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import sinon from 'sinon';
import { buildConfigFromYml } from '../../src/dependency-manager/src/spec/utils/component-builder';
import { mockArchitectAuth, MOCK_API_HOST } from '../utils/mocks';

describe('init', function () {

  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

  const account_name = 'examples';
  const compose_file_name = 'init-compose.yml';
  const compose_file_path = path.join(__dirname, `../mocks/${compose_file_name}`);

  const mockInit = () => {
    return mockArchitectAuth
      .stub(fs, 'writeFileSync', sinon.stub().returns(undefined))
      .nock(MOCK_API_HOST, api => api
        .get(`/accounts/${account_name}`)
        .reply(200, {})
      )
      .stdout({ print })
      .stderr({ print })
  }

  mockInit()
    .command(['init', '--from-compose', compose_file_path, '-a', account_name, '-n', 'test-component'])
    .it('converts a docker-compose file to an architect component file', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      expect(ctx.stdout).to.contain(`Converted ${compose_file_name} and wrote Architect component config to architect.yml`);
      expect(ctx.stdout).to.contain('The component config may be incomplete and should be checked for consistency with the context of your application. Helpful reference docs can be found at https://www.architect.io/docs/reference/component-spec.');
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, '-a', account_name, '-n', 'test-component', '-o', 'test-directory/architect.yml'])
    .it('converts a docker-compose file to an architect component file and writes the file to a specified output', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;
      expect(writeFileSync.args[0][0]).eq('test-directory/architect.yml');
      expect(ctx.stdout).to.contain(`Converted ${compose_file_name} and wrote Architect component config to test-directory/architect.yml`);
      expect(ctx.stdout).to.contain('The component config may be incomplete and should be checked for consistency with the context of your application. Helpful reference docs can be found at https://www.architect.io/docs/reference/component-spec.');
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, '-a', account_name, '-n', 'test-component'])
    .it('names the component based on the input args', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      expect(component_config.name).eq(`${account_name}/test-component`);
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, '-a', account_name, '-n', 'test-component'])
    .it('converts all services from the docker compose file to architect services', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      expect(Object.keys(component_config.services || {})).deep.equal(['elasticsearch', 'logstash', 'kibana']);
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, '-a', account_name, '-n', 'test-component'])
    .it('adds environment variables to each service', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      expect(component_config.services['elasticsearch'].environment['ES_JAVA_OPTS']).eq('-Xmx256m -Xms256m');
      expect(component_config.services['elasticsearch'].environment['ELASTIC_PASSWORD']).eq('changeme');
      expect(component_config.services['elasticsearch'].environment['DISCOVERY_TYPE']).eq('single-node');
      expect(component_config.services['elasticsearch'].environment['TEST_NUMBER']).eq('3000');
      expect(component_config.services['logstash'].environment['LS_JAVA_OPTS']).eq('-Xmx256m -Xms256m');
      expect(component_config.services['logstash'].environment['ELASTICSEARCH_URL']).eq('${{ services.elasticsearch.interfaces.main.url }}');
      expect(component_config.services['logstash'].environment['KIBANA_URL']).eq('${{ services.kibana.interfaces.main.url }}');
      expect(component_config.services['kibana'].environment['ELASTICSEARCH_URL']).eq('${{ services.elasticsearch.interfaces.main.url }}');
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, '-a', account_name, '-n', 'test-component'])
    .it('adds command to logstash service', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      expect(component_config.services['logstash'].command).deep.eq(['npm', 'run', 'start']);
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, '-a', account_name, '-n', 'test-component'])
    .it('adds entrypoint to logstash service', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      expect(component_config.services['logstash'].entrypoint).deep.eq(['entrypoint.sh']);
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, '-a', account_name, '-n', 'test-component'])
    .it('adds image to kibana service', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      expect(component_config.services['kibana'].image).eq('docker.elastic.co/kibana/kibana:7.8.0');
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, '-a', account_name, '-n', 'test-component'])
    .it('adds build context and args to elasticsearch service', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      expect(component_config.services['elasticsearch'].build!.args!['ELK_VERSION']).eq('$ELK_VERSION');
      expect(component_config.services['elasticsearch'].build!.context).eq('elasticsearch/');
      expect(component_config.services['elasticsearch'].build!.dockerfile).eq('Dockerfile.elasticsearch');
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, '-a', account_name, '-n', 'test-component'])
    .it('adds ports of various docker-compose types to kibana service config', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      expect(component_config.services['kibana'].interfaces['main'].port).eq(5601);
      expect(component_config.services['kibana'].interfaces['main2'].port).eq(5000);
      expect(component_config.services['kibana'].interfaces['main2'].protocol).eq('udp');
      expect(component_config.services['kibana'].interfaces['main3'].port).eq(8001);
      expect(component_config.services['kibana'].interfaces['main4'].port).eq(3000);
      expect(component_config.services['kibana'].interfaces['main5'].port).eq(4000);
      expect(component_config.services['kibana'].interfaces['main10'].port).eq(4005);
      expect(component_config.services['kibana'].interfaces['main11'].port).eq(1240);
      expect(component_config.services['kibana'].interfaces['main12'].port).eq(8080);
      expect(component_config.services['kibana'].interfaces['main13'].port).eq(8081);
      expect(component_config.services['kibana'].interfaces['main14'].port).eq(5000);
      expect(component_config.services['kibana'].interfaces['main24'].port).eq(5010);
      expect(component_config.services['kibana'].interfaces['main25'].port).eq(4444);
      expect(component_config.services['kibana'].interfaces['main25'].protocol).eq('tcp');
      expect(component_config.services['kibana'].interfaces['main26'].port).eq(4445);
      expect(component_config.services['kibana'].interfaces['main26'].protocol).eq('udp');
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, '-a', account_name, '-n', 'test-component'])
    .it('adds ports to service component config', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      expect(component_config.services['elasticsearch'].interfaces['main'].port).eq(9200);
      expect(component_config.services['elasticsearch'].interfaces['main2'].port).eq(9300);
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, '-a', account_name, '-n', 'test-component'])
    .it('adds ports to logstash service config', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      expect(component_config.services['logstash'].interfaces['main'].port).eq(5000);
      expect(component_config.services['logstash'].interfaces['main'].protocol).eq('tcp');
      expect(component_config.services['logstash'].interfaces['main2'].port).eq(5000);
      expect(component_config.services['logstash'].interfaces['main2'].protocol).eq('udp');
      expect(component_config.services['logstash'].interfaces['main3'].port).eq(9600);
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, '-a', account_name, '-n', 'test-component'])
    .it('adds debug and regular volumes to elasticsearch service config', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      const component_object: any = yaml.load(writeFileSync.args[0][1]);
      expect(component_config.services['elasticsearch'].volumes['volume2'].mount_path).eq('/usr/share/elasticsearch/data');
      expect(component_object.services['elasticsearch']["${{ if architect.environment == 'local' }}"].volumes['volume'].mount_path).eq('/usr/share/elasticsearch/config/elasticsearch.yml');
      expect(component_object.services['elasticsearch']["${{ if architect.environment == 'local' }}"].volumes['volume'].host_path).eq('./elasticsearch/config/elasticsearch.yml');
      expect(component_object.services['elasticsearch']["${{ if architect.environment == 'local' }}"].volumes['volume'].readonly).eq(true);
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, '-a', account_name, '-n', 'test-component'])
    .it('adds debug volumes to logstash service config', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      const component_object: any = yaml.load(writeFileSync.args[0][1]);
      expect(component_object.services['logstash']["${{ if architect.environment == 'local' }}"].volumes['volume'].mount_path).eq('/usr/share/logstash/config/logstash.yml');
      expect(component_object.services['logstash']["${{ if architect.environment == 'local' }}"].volumes['volume'].host_path).eq('./logstash/config/logstash.yml');
      expect(component_object.services['logstash']["${{ if architect.environment == 'local' }}"].volumes['volume'].readonly).eq(true);
      expect(component_object.services['logstash']["${{ if architect.environment == 'local' }}"].volumes['volume2'].mount_path).eq('/usr/share/logstash/pipeline');
      expect(component_object.services['logstash']["${{ if architect.environment == 'local' }}"].volumes['volume2'].host_path).eq('./logstash/pipeline');
      expect(component_object.services['logstash']["${{ if architect.environment == 'local' }}"].volumes['volume2'].readonly).eq(true);
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, '-a', account_name, '-n', 'test-component'])
    .it('adds debug and regular volumes to kibana service config', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      const component_object: any = yaml.load(writeFileSync.args[0][1]);
      expect(component_object.services['kibana']["${{ if architect.environment == 'local' }}"].volumes['volume'].mount_path).eq('/usr/share/kibana/config/kibana.yml');
      expect(component_object.services['kibana']["${{ if architect.environment == 'local' }}"].volumes['volume'].host_path).eq('./kibana/config/kibana.yml');
      expect(component_object.services['kibana']["${{ if architect.environment == 'local' }}"].volumes['volume'].readonly).eq(true);
      expect(component_config.services['kibana'].volumes['volume2'].mount_path).eq('/var/lib/mysql');
      expect(component_config.services['kibana'].volumes['volume2'].host_path).is.undefined;
      expect(component_object.services['kibana']["${{ if architect.environment == 'local' }}"].volumes['volume3'].mount_path).eq('/var/lib/mysql');
      expect(component_object.services['kibana']["${{ if architect.environment == 'local' }}"].volumes['volume3'].host_path).eq('/opt/data');
      expect(component_object.services['kibana']["${{ if architect.environment == 'local' }}"].volumes['volume4'].mount_path).eq('/tmp/cache');
      expect(component_object.services['kibana']["${{ if architect.environment == 'local' }}"].volumes['volume4'].host_path).eq('./cache');
      expect(component_object.services['kibana']["${{ if architect.environment == 'local' }}"].volumes['volume5'].mount_path).eq('/etc/configs/');
      expect(component_object.services['kibana']["${{ if architect.environment == 'local' }}"].volumes['volume5'].host_path).eq('~/configs');
      expect(component_object.services['kibana']["${{ if architect.environment == 'local' }}"].volumes['volume5'].readonly).eq(true);
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, '-a', account_name, '-n', 'test-component'])
    .it('prints a warning if a field from the docker compose cannot be converted', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      expect(ctx.stdout).to.contain(`Could not convert elasticsearch property networks`);
      expect(ctx.stdout).to.contain(`Could not convert logstash property networks`);
      expect(ctx.stdout).to.contain(`Could not convert kibana property networks`);
    });

  mockArchitectAuth
    .stub(fs, 'writeFileSync', sinon.stub().returns(undefined))
    .nock(MOCK_API_HOST, api => api
      .get(`/users/me`)
      .reply(200, {
        memberships: [
          {
            account: {
              name: 'my-account'
            },
          }
        ],
      })
    )
    .stdout({ print })
    .stderr({ print })
    .command(['init', '--from-compose', path.join(__dirname, '../mocks/init-compose.yml'), '-n', 'test-component'])
    .it('uses only account membership if only one exists and account is unspecified', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      expect(component_config.name).eq('my-account/test-component');
    });
});
