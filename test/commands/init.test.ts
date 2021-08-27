import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import sinon from 'sinon';
import { buildConfigFromYml, Slugs } from '../../src/dependency-manager/src';
import { mockArchitectAuth, MOCK_API_HOST } from '../utils/mocks';

describe('init', function () {

  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

  const account_name = 'examples';

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
    .command(['init', '--from-compose', path.join(__dirname, '../mocks/init-compose.yml'), '-a', account_name, '-n', 'test-component'])
    .it('converts a docker-compose file to an architect component file', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      expect(ctx.stdout).to.contain('Wrote Architect component config to architect.yml');
      expect(ctx.stdout).to.contain('The component config may be incomplete and should be checked for consistency with the context of your application. Helpful reference docs can be found at https://www.architect.io/docs/reference/component-spec.');
    });

  mockInit()
    .command(['init', '--from-compose', path.join(__dirname, '../mocks/init-compose.yml'), '-a', account_name, '-n', 'test-component', '-o', 'test-directory/architect.yml'])
    .it('converts a docker-compose file to an architect component file and writes the file to a specified output', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;
      expect(writeFileSync.args[0][0]).eq('test-directory/architect.yml');
      expect(ctx.stdout).to.contain('Wrote Architect component config to test-directory/architect.yml');
      expect(ctx.stdout).to.contain('The component config may be incomplete and should be checked for consistency with the context of your application. Helpful reference docs can be found at https://www.architect.io/docs/reference/component-spec.');
    });

  mockInit()
    .command(['init', '--from-compose', path.join(__dirname, '../mocks/init-compose.yml'), '-a', account_name, '-n', 'test-component'])
    .it('names the component based on the input args', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1], Slugs.DEFAULT_TAG);
      expect(component_config.name).eq(`${account_name}/test-component`);
    });

  mockInit()
    .command(['init', '--from-compose', path.join(__dirname, '../mocks/init-compose.yml'), '-a', account_name, '-n', 'test-component'])
    .it('converts all services from the docker compose file to architect services', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1], Slugs.DEFAULT_TAG);
      expect(Object.keys(component_config.services || {})).deep.equal(['elasticsearch', 'logstash', 'kibana']);
    });

  mockInit()
    .command(['init', '--from-compose', path.join(__dirname, '../mocks/init-compose.yml'), '-a', account_name, '-n', 'test-component'])
    .it('adds initial descriptions to each service', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1], Slugs.DEFAULT_TAG);
      expect(component_config.services['elasticsearch'].description).eq('elasticsearch converted to an Architect service with "architect init"');
      expect(component_config.services['kibana'].description).eq('kibana converted to an Architect service with "architect init"');
      expect(component_config.services['logstash'].description).eq('logstash converted to an Architect service with "architect init"');
    });

  mockInit()
    .command(['init', '--from-compose', path.join(__dirname, '../mocks/init-compose.yml'), '-a', account_name, '-n', 'test-component'])
    .it('adds environment variables to each service', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1], Slugs.DEFAULT_TAG);
      expect(component_config.services['elasticsearch'].environment['ES_JAVA_OPTS']).eq('-Xmx256m -Xms256m');
      expect(component_config.services['elasticsearch'].environment['ELASTIC_PASSWORD']).eq('changeme');
      expect(component_config.services['elasticsearch'].environment['DISCOVERY_TYPE']).eq('single-node');
      expect(component_config.services['elasticsearch'].environment['TEST_NUMBER']).eq('3000');
      expect(component_config.services['logstash'].environment['LS_JAVA_OPTS']).eq('-Xmx256m -Xms256m');
      expect(component_config.services['logstash'].environment['ELASTICSEARCH_URL']).eq('${{ services.elasticsearch.interfaces.interface0.url }}');
      expect(component_config.services['logstash'].environment['KIBANA_URL']).eq('${{ services.kibana.interfaces.interface0.url }}');
      expect(component_config.services['kibana'].environment['ELASTICSEARCH_URL']).eq('${{ services.elasticsearch.interfaces.interface0.url }}');
    });

  mockInit()
    .command(['init', '--from-compose', path.join(__dirname, '../mocks/init-compose.yml'), '-a', account_name, '-n', 'test-component'])
    .it('adds command to logstash service', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1], Slugs.DEFAULT_TAG);
      expect(component_config.services['logstash'].command).deep.eq(['npm', 'run', 'start']);
    });

  mockInit()
    .command(['init', '--from-compose', path.join(__dirname, '../mocks/init-compose.yml'), '-a', account_name, '-n', 'test-component'])
    .it('adds entrypoint to logstash service', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1], Slugs.DEFAULT_TAG);
      expect(component_config.services['logstash'].entrypoint).deep.eq(['entrypoint.sh']);
    });

  mockInit()
    .command(['init', '--from-compose', path.join(__dirname, '../mocks/init-compose.yml'), '-a', account_name, '-n', 'test-component'])
    .it('adds image to kibana service', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1], Slugs.DEFAULT_TAG);
      expect(component_config.services['kibana'].image).eq('docker.elastic.co/kibana/kibana:7.8.0');
    });

  mockInit()
    .command(['init', '--from-compose', path.join(__dirname, '../mocks/init-compose.yml'), '-a', account_name, '-n', 'test-component'])
    .it('adds build context and args to elasticsearch service', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1], Slugs.DEFAULT_TAG);
      expect(component_config.services['elasticsearch'].build!.args!['ELK_VERSION']).eq('$ELK_VERSION');
      expect(component_config.services['elasticsearch'].build!.context).eq('elasticsearch/');
      expect(component_config.services['elasticsearch'].build!.dockerfile).eq('Dockerfile.elasticsearch');
    });

  mockInit()
    .command(['init', '--from-compose', path.join(__dirname, '../mocks/init-compose.yml'), '-a', account_name, '-n', 'test-component'])
    .it('adds ports of various docker-compose types to kibana service config', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1], Slugs.DEFAULT_TAG);
      // TODO:290: these tests should expect the port to be a number instead of a string
      expect(component_config.services['kibana'].interfaces['interface0'].port).eq(5601);
      expect(component_config.services['kibana'].interfaces['interface1'].port).eq(5000);
      expect(component_config.services['kibana'].interfaces['interface1'].protocol).eq('udp');
      expect(component_config.services['kibana'].interfaces['interface2'].port).eq(8001);
      expect(component_config.services['kibana'].interfaces['interface3'].port).eq(3000);
      expect(component_config.services['kibana'].interfaces['interface4'].port).eq(4000);
      expect(component_config.services['kibana'].interfaces['interface9'].port).eq(4005);
      expect(component_config.services['kibana'].interfaces['interface10'].port).eq(1240);
      expect(component_config.services['kibana'].interfaces['interface11'].port).eq(8080);
      expect(component_config.services['kibana'].interfaces['interface12'].port).eq(8081);
      expect(component_config.services['kibana'].interfaces['interface13'].port).eq(5000);
      expect(component_config.services['kibana'].interfaces['interface23'].port).eq(5010);
      expect(component_config.services['kibana'].interfaces['interface24'].port).eq(4444);
      expect(component_config.services['kibana'].interfaces['interface24'].protocol).eq('tcp');
      expect(component_config.services['kibana'].interfaces['interface25'].port).eq(4445);
      expect(component_config.services['kibana'].interfaces['interface25'].protocol).eq('udp');
    });

  mockInit()
    .command(['init', '--from-compose', path.join(__dirname, '../mocks/init-compose.yml'), '-a', account_name, '-n', 'test-component'])
    .it('adds ports to service component config', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1], Slugs.DEFAULT_TAG);
      expect(component_config.services['elasticsearch'].interfaces['interface0'].port).eq(9200);
      expect(component_config.services['elasticsearch'].interfaces['interface1'].port).eq(9300);
    });

  mockInit()
    .command(['init', '--from-compose', path.join(__dirname, '../mocks/init-compose.yml'), '-a', account_name, '-n', 'test-component'])
    .it('adds ports to logstash service config', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1], Slugs.DEFAULT_TAG);
      expect(component_config.services['logstash'].interfaces['interface0'].port).eq(5000);
      expect(component_config.services['logstash'].interfaces['interface0'].protocol).eq('tcp');
      expect(component_config.services['logstash'].interfaces['interface1'].port).eq(5000);
      expect(component_config.services['logstash'].interfaces['interface1'].protocol).eq('udp');
      expect(component_config.services['logstash'].interfaces['interface2'].port).eq(9600);
    });

  mockInit()
    .command(['init', '--from-compose', path.join(__dirname, '../mocks/init-compose.yml'), '-a', account_name, '-n', 'test-component'])
    .it('adds debug and regular volumes to elasticsearch service config', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1], Slugs.DEFAULT_TAG);
      expect(component_config.services['elasticsearch'].volumes['volume1'].mount_path).eq('/usr/share/elasticsearch/data');
      expect(component_config.services['elasticsearch'].debug!.volumes['volume0'].mount_path).eq('/usr/share/elasticsearch/config/elasticsearch.yml');
      expect(component_config.services['elasticsearch'].debug!.volumes['volume0'].host_path).eq('./elasticsearch/config/elasticsearch.yml');
      expect(component_config.services['elasticsearch'].debug!.volumes['volume0'].readonly).eq(true);
    });

  mockInit()
    .command(['init', '--from-compose', path.join(__dirname, '../mocks/init-compose.yml'), '-a', account_name, '-n', 'test-component'])
    .it('adds debug volumes to logstash service config', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1], Slugs.DEFAULT_TAG);
      expect(component_config.services['logstash'].debug!.volumes['volume0'].mount_path).eq('/usr/share/logstash/config/logstash.yml');
      expect(component_config.services['logstash'].debug!.volumes['volume0'].host_path).eq('./logstash/config/logstash.yml');
      expect(component_config.services['logstash'].debug!.volumes['volume0'].readonly).eq(true);
      expect(component_config.services['logstash'].debug!.volumes['volume1'].mount_path).eq('/usr/share/logstash/pipeline');
      expect(component_config.services['logstash'].debug!.volumes['volume1'].host_path).eq('./logstash/pipeline');
      expect(component_config.services['logstash'].debug!.volumes['volume1'].readonly).eq(true);
    });

  mockInit()
    .command(['init', '--from-compose', path.join(__dirname, '../mocks/init-compose.yml'), '-a', account_name, '-n', 'test-component'])
    .it('adds debug and regular volumes to kibana service config', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1], Slugs.DEFAULT_TAG);
      expect(component_config.services['kibana'].debug!.volumes['volume0'].mount_path).eq('/usr/share/kibana/config/kibana.yml');
      expect(component_config.services['kibana'].debug!.volumes['volume0'].host_path).eq('./kibana/config/kibana.yml');
      expect(component_config.services['kibana'].debug!.volumes['volume0'].readonly).eq(true);
      expect(component_config.services['kibana'].volumes['volume1'].mount_path).eq('/var/lib/mysql');
      expect(component_config.services['kibana'].volumes['volume1'].host_path).is.undefined;
      expect(component_config.services['kibana'].debug!.volumes['volume2'].mount_path).eq('/var/lib/mysql');
      expect(component_config.services['kibana'].debug!.volumes['volume2'].host_path).eq('/opt/data');
      expect(component_config.services['kibana'].debug!.volumes['volume3'].mount_path).eq('/tmp/cache');
      expect(component_config.services['kibana'].debug!.volumes['volume3'].host_path).eq('./cache');
      expect(component_config.services['kibana'].debug!.volumes['volume4'].mount_path).eq('/etc/configs/');
      expect(component_config.services['kibana'].debug!.volumes['volume4'].host_path).eq('~/configs');
      expect(component_config.services['kibana'].debug!.volumes['volume4'].readonly).eq(true);

    });
});
