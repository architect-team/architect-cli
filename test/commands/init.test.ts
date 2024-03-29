import { expect } from 'chai';
import fs from 'fs';
import yaml from 'js-yaml';
import mock_fs from 'mock-fs';
import path from 'path';
import sinon from 'sinon';
import { buildConfigFromYml, Slugs } from '../../src';
import ProjectUtils from '../../src/architect/project/project.utils';
import { InitCommand } from '../../src/commands/init';
import { mockArchitectAuth } from '../utils/mocks';

describe('init', function () {
  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

  const compose_file_name = 'init-compose.yml';
  const compose_file_path = path.join(__dirname, `../mocks/${compose_file_name}`);
  const mock_compose_contents = `
version: "3.7"

services:
`;

  const mockInit = () => {
    return mockArchitectAuth()
      .stub(fs, 'writeFileSync', sinon.stub().returns(undefined))
      .stdout({ print })
      .stderr({ print });
  };

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('converts a docker-compose file to an architect component file', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      expect(ctx.stdout).to.contain(`Converted ${compose_file_name} and wrote Architect component config to architect.yml`);
      expect(ctx.stdout).to.contain('The component config may be incomplete and should be checked for consistency with the context of your application. Helpful reference docs can be found at https://docs.architect.io/components/architect-yml.');
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component', '-o', 'test-directory/architect.yml'])
    .it('converts a docker-compose file to an architect component file and writes the file to a specified output', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;
      expect(writeFileSync.args[0][0]).eq('test-directory/architect.yml');
      expect(ctx.stdout).to.contain(`Converted ${compose_file_name} and wrote Architect component config to test-directory/architect.yml`);
      expect(ctx.stdout).to.contain('The component config may be incomplete and should be checked for consistency with the context of your application. Helpful reference docs can be found at https://docs.architect.io/components/architect-yml.');
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('names the component based on the input args', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      expect(component_config.name).eq(`test-component`);
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('converts all services from the docker compose file to architect services', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      expect(Object.keys(component_config.services || {})).deep.equal(['elasticsearch', 'logstash', 'kibana', 'db']);
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component', '-o', 'test-directory/architect.yml'])
    .it('converts different types of build arg value of the docker compose file', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;
      expect(writeFileSync.args[0][0]).eq('test-directory/architect.yml');
      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      expect(component_config.services.logstash.build!.args!.ELK_VERSION).eq('${{ secrets.ELK_VERSION }}');
      expect(component_config.services.logstash.build!.args!.INT_ARG).eq('1');
      expect(component_config.services.logstash.build!.args!.BOOL_ARG).eq('true');
      expect(component_config.services.logstash.build!.args!.EMPTY_ARG).eq('null');
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('adds environment variables to each service', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      expect(component_config.services.elasticsearch.environment.ES_JAVA_OPTS).eq('-Xmx256m -Xms256m');
      expect(component_config.services.elasticsearch.environment.ELASTIC_PASSWORD).eq('changeme');
      expect(component_config.services.elasticsearch.environment.DISCOVERY_TYPE).eq('single-node');
      expect(component_config.services.elasticsearch.environment.TEST_NUMBER).eq('3000');
      expect(component_config.services.logstash.environment.LS_JAVA_OPTS).eq('-Xmx256m -Xms256m');
      expect(component_config.services.logstash.environment.ELASTICSEARCH_URL).eq('${{ services.elasticsearch.interfaces.main.url }}');
      expect(component_config.services.logstash.environment.KIBANA_URL).eq('${{ services.kibana.interfaces.main.url }}');
      expect(component_config.services.kibana.environment.ELASTICSEARCH_URL).eq('${{ services.elasticsearch.interfaces.main.url }}');
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('converts environment variables from compose listed as an array', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      expect(component_config.services.kibana.environment.DB_TYPE).eq('postgres');
      expect(component_config.services.kibana.environment.DB_NAME).eq('gitea');
      expect(component_config.services.kibana.environment.DB_USER).eq('gitea');
      expect(component_config.services.kibana.environment.DB_PASSWD).eq('gitea');
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it(`warns the user if a listed environment variable couldn't be converted`, ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      expect(ctx.stdout).to.contain('Could not convert environment variable DB_HOST');
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('adds command to logstash service', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      expect(component_config.services.logstash.command).deep.eq(['npm', 'run', 'start']);
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('adds entrypoint to logstash service', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      expect(component_config.services.logstash.entrypoint).deep.eq(['entrypoint.sh']);
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('adds image to kibana service', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      expect(component_config.services.kibana.image).eq('docker.elastic.co/kibana/kibana:7.8.0');
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('adds build context and args to elasticsearch service', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      expect(component_config.services.elasticsearch.build!.args!.ELK_VERSION).eq('${{ secrets.ELK_VERSION }}');
      expect(component_config.services.elasticsearch.build!.args!.INT_ARG).eq('1');
      expect(component_config.services.elasticsearch.build!.args!.BOOL_ARG).eq('true');
      expect(component_config.services.elasticsearch.build!.args!.EMPTY_ARG).eq('null');
      expect(component_config.services.elasticsearch.build!.args!.EMPTY_ARG2).eq('null');
      expect(component_config.services.elasticsearch.build!.context).eq('elasticsearch/');
      expect(component_config.services.elasticsearch.build!.dockerfile).eq('Dockerfile.elasticsearch');
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('adds ports of various docker-compose types to kibana service config', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      expect(component_config.services.kibana.interfaces.main.port).eq(5601);
      expect(component_config.services.kibana.interfaces.main2.port).eq(5000);
      expect(component_config.services.kibana.interfaces.main2.protocol).eq('udp');
      expect(component_config.services.kibana.interfaces.main3.port).eq(8001);
      expect(component_config.services.kibana.interfaces.main4.port).eq(3000);
      expect(component_config.services.kibana.interfaces.main5.port).eq(4000);
      expect(component_config.services.kibana.interfaces.main10.port).eq(4005);
      expect(component_config.services.kibana.interfaces.main11.port).eq(1240);
      expect(component_config.services.kibana.interfaces.main12.port).eq(8080);
      expect(component_config.services.kibana.interfaces.main13.port).eq(8081);
      expect(component_config.services.kibana.interfaces.main14.port).eq(5000);
      expect(component_config.services.kibana.interfaces.main24.port).eq(5010);
      expect(component_config.services.kibana.interfaces.main25.port).eq(4444);
      expect(component_config.services.kibana.interfaces.main25.protocol).eq('tcp');
      expect(component_config.services.kibana.interfaces.main26.port).eq(4445);
      expect(component_config.services.kibana.interfaces.main26.protocol).eq('udp');
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('adds ports to service component config', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      expect(component_config.services.elasticsearch.interfaces.main.port).eq(9200);
      expect(component_config.services.elasticsearch.interfaces.main2.port).eq(9300);
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('adds ports to logstash service config', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_config = buildConfigFromYml(writeFileSync.args[0][1]);
      expect(component_config.services.logstash.interfaces.main.port).eq(5000);
      expect(component_config.services.logstash.interfaces.main.protocol).eq('tcp');
      expect(component_config.services.logstash.interfaces.main2.port).eq(5000);
      expect(component_config.services.logstash.interfaces.main2.protocol).eq('udp');
      expect(component_config.services.logstash.interfaces.main3.port).eq(9600);
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('adds debug and regular volumes to elasticsearch service config', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_object: any = yaml.load(writeFileSync.args[0][1]);
      expect(component_object.services.elasticsearch.debug.volumes.volume2.mount_path).eq('/usr/share/elasticsearch/data');
      expect(component_object.services.elasticsearch.debug.volumes.volume.mount_path).eq('/usr/share/elasticsearch/config/elasticsearch.yml');
      expect(component_object.services.elasticsearch.debug.volumes.volume.host_path).eq('./elasticsearch/config/elasticsearch.yml');
      expect(component_object.services.elasticsearch.debug.volumes.volume.readonly).eq(true);
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('adds debug volumes to logstash service config', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_object: any = yaml.load(writeFileSync.args[0][1]);
      expect(component_object.services.logstash.debug.volumes.volume.mount_path).eq('/usr/share/logstash/config/logstash.yml');
      expect(component_object.services.logstash.debug.volumes.volume.host_path).eq('./logstash/config/logstash.yml');
      expect(component_object.services.logstash.debug.volumes.volume.readonly).eq(true);
      expect(component_object.services.logstash.debug.volumes.volume2.mount_path).eq('/usr/share/logstash/pipeline');
      expect(component_object.services.logstash.debug.volumes.volume2.host_path).eq('./logstash/pipeline');
      expect(component_object.services.logstash.debug.volumes.volume2.readonly).eq(true);
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('adds debug and regular volumes to kibana service config', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_object: any = yaml.load(writeFileSync.args[0][1]);
      expect(component_object.services.kibana.debug.volumes.volume.mount_path).eq('/usr/share/kibana/config/kibana.yml');
      expect(component_object.services.kibana.debug.volumes.volume.host_path).eq('./kibana/config/kibana.yml');
      expect(component_object.services.kibana.debug.volumes.volume.readonly).eq(true);
      expect(component_object.services.kibana.debug.volumes.volume2.mount_path).eq('/var/lib/mysql');
      expect(component_object.services.kibana.debug.volumes.volume2.host_path).is.undefined;
      expect(component_object.services.kibana.debug.volumes.volume3.mount_path).eq('/var/lib/mysql');
      expect(component_object.services.kibana.debug.volumes.volume3.host_path).eq('/opt/data');
      expect(component_object.services.kibana.debug.volumes.volume4.mount_path).eq('/tmp/cache');
      expect(component_object.services.kibana.debug.volumes.volume4.host_path).eq('./cache');
      expect(component_object.services.kibana.debug.volumes.volume5.mount_path).eq('/etc/configs/');
      expect(component_object.services.kibana.debug.volumes.volume5.host_path).eq('~/configs');
      expect(component_object.services.kibana.debug.volumes.volume5.readonly).eq(true);
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('adds context targets to compose where appropriate', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_object: any = yaml.load(writeFileSync.args[0][1]);
      expect(component_object.services.elasticsearch.build.target).eq('production');
      expect(component_object.services.logstash.build.target).eq('build');
      expect(component_object.services.kibana.build?.target).undefined;
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('prints a warning if a field from the docker compose cannot be converted', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      expect(ctx.stdout).to.contain(`Could not convert elasticsearch property "networks"`);
      expect(ctx.stdout).to.contain(`Could not convert logstash property "networks"`);
      expect(ctx.stdout).to.contain(`Could not convert kibana property "networks"`);
    });

  it('finds a compose file in the current directory', async () => {
    mock_fs({
      './docker-compose.yml': mock_compose_contents,
    });

    const getDefaultDockerComposeFile = InitCommand.prototype.getDefaultDockerComposeFile;
    const compose_path = await getDefaultDockerComposeFile();
    expect(compose_path).eq('docker-compose.yml');
  });

  it('finds an oddly named compose file in the current directory', async () => {
    mock_fs({
      './compose.yml': mock_compose_contents,
    });

    const getDefaultDockerComposeFile = InitCommand.prototype.getDefaultDockerComposeFile;
    const compose_path = await getDefaultDockerComposeFile();
    expect(compose_path).eq('compose.yml');
  });

  it('finds the preferred docker compose file names first', async () => {
    mock_fs({
      './compose.yml': mock_compose_contents,
      './docker-compose.yaml': mock_compose_contents,
    });

    const getDefaultDockerComposeFile = InitCommand.prototype.getDefaultDockerComposeFile;
    const compose_path = await getDefaultDockerComposeFile();
    expect(compose_path).eq('docker-compose.yaml');
  });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('converts a healthcheck with cmd-shell to a liveness probe', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_object: any = yaml.load(writeFileSync.args[0][1]);
      expect(component_object.services.elasticsearch.liveness_probe).deep.eq({
        command: ['/opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P example_123 -Q \'SELECT 1\''],
        interval: '10s',
        timeout: '3s',
        failure_threshold: 10,
        initial_delay: '10s',
      });
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('converts a healthcheck with cmd to a liveness probe', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_object: any = yaml.load(writeFileSync.args[0][1]);
      expect(component_object.services.logstash.liveness_probe).deep.eq({
        command: ['mysqladmin', 'ping', '-h', '127.0.0.1', '--silent'],
        interval: '3s',
        failure_threshold: 5,
        initial_delay: '30s',
      });
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('converts a healthcheck string to a liveness probe', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_object: any = yaml.load(writeFileSync.args[0][1]);
      expect(component_object.services.kibana.liveness_probe).deep.eq({
        command: 'curl google.com',
      });
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('converts a container name to a reserved name', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_object: any = yaml.load(writeFileSync.args[0][1]);
      expect(component_object.services.logstash.reserved_name).eq('logstash-service');
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('adds an interface for each exposed port', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_object: any = yaml.load(writeFileSync.args[0][1]);
      expect(component_object.services.elasticsearch.interfaces.expose.port).eq(5432);
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('adding cpu and memory resources', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_object: any = yaml.load(writeFileSync.args[0][1]);
      expect(component_object.services.logstash.cpu).eq(0.25);
      expect(component_object.services.logstash.memory).eq('1.5G');
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('converting labels in array format', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_object: any = yaml.load(writeFileSync.args[0][1]);
      expect(component_object.services.kibana.labels.enable).eq('true');
      expect(component_object.services.kibana.labels.rule).eq('test');
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it('converting labels in object format', ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_object: any = yaml.load(writeFileSync.args[0][1]);
      expect(component_object.services.logstash.labels.ENABLE).eq('true');
      expect(component_object.services.logstash.labels.RULE).eq('test');
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it(`warns the user if a listed label couldn't be converted because it isn't split by an = sign`, ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      expect(ctx.stdout).to.contain('Could not convert label key_only as it is not 2 parts separated by an "=" sign');
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it(`warns the user if a listed label couldn't be converted because of an invalid key`, ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      expect(ctx.stdout).to.contain(`Label with key rule.invalid&key could not be converted as it fails validation with regex ${Slugs.LabelKeySlugValidatorString}`);
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it(`warns the user if a listed label couldn't be converted because of an invalid value`, ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      expect(ctx.stdout).to.contain(`Label with value Path(\`/\`) could not be converted as it fails validation with regex ${Slugs.LabelValueSlugValidatorString}`);
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it(`converting interpolation of environment variables in image`, ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_object: any = yaml.load(writeFileSync.args[0][1]);
      expect(component_object.services.db.image).eq('postgres:${{ secrets.POSTGRES_VERSION }}');
      expect(component_object.secrets.POSTGRES_VERSION).deep.eq({ required: false });
    });

  mockInit()
    .command(['init', '--from-compose', compose_file_path, 'test-component'])
    .it(`converting differnt syntax of environment variable interpolations in environment`, ctx => {
      const writeFileSync = fs.writeFileSync as sinon.SinonStub;
      expect(writeFileSync.called).to.be.true;

      const component_object: any = yaml.load(writeFileSync.args[0][1]);
      expect(component_object.services.db.environment.POSTGRES_USER).eq('${{ secrets.DB_USER }}');
      expect(component_object.services.db.environment.POSTGRES_PASSWORD).eq('${{ secrets.DB_PASSWORD }}');
      expect(component_object.services.db.environment.POSTGRES_DB).eq('${{ secrets.DB_NAME }}');

      expect(component_object.secrets.DB_USER).deep.eq({ required: true });
      expect(component_object.secrets.DB_PASSWORD).deep.eq({ required: false });
      expect(component_object.secrets.DB_NAME).deep.eq({ default: 'my-db' });
    });

  mockInit()
    .stub(ProjectUtils, 'getSelections', () => {
      return {};
    })
    .stub(ProjectUtils, 'downloadGitHubRepos', sinon.stub())
    .stdout({ print })
    .stderr({ print })
    .command(['init', 'my-react-project'])
    .it('Create project successfully with project flag', async ctx => {
      expect(ctx.stdout).to.contain('Successfully created project');
      const download_repos = ProjectUtils.downloadGitHubRepos as sinon.SinonStub;
      expect(download_repos.callCount).to.eq(1);
    });

  mockInit()
    .stub(ProjectUtils, 'getSelections', sinon.stub().returns({}))
    .stub(ProjectUtils, 'downloadGitHubRepos', sinon.stub())
    .stdout({ print })
    .stderr({ print })
    .command(['init', 'my-react-project2', '--starter', 'Go'])
    .it('Create project successfully with project flag and starter flag', async ctx => {
      expect(ctx.stdout).to.contain('Successfully created project');
      const download_repos = ProjectUtils.downloadGitHubRepos as sinon.SinonStub;
      const get_selections = ProjectUtils.getSelections as sinon.SinonStub;
      expect(download_repos.callCount).to.eq(1);
      expect(get_selections.callCount).to.eq(1);
      expect(get_selections.getCall(0).args[0]).to.eq('Go');
    });
});
