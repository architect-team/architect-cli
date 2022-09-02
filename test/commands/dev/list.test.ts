import { expect } from '@oclif/test';
import sinon, { SinonSpy } from 'sinon';
import BaseTable from '../../../src/base-table';
import { DockerComposeUtils } from '../../../src/common/docker-compose';
import { mockArchitectAuth } from '../../utils/mocks';
import DevList from '../../../src/commands/dev/list';
import { inspect } from 'util';

function createTestContainer(name: string, image_name?: string) {
  const test_container: any = {
    Name: image_name || 'image_name_not_used',
    State: {
      Status: 'running',
    },
    Config: {
      Labels: {},
    },
  };

  if (!image_name) {
    test_container.Config.Labels['com.docker.compose.service'] = name;
  }

  return test_container;
}

describe('dev:list', () => {

  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

  const sample_env_1 = 'arc_test_env';
  const sample_env_2 = 'arc_test_env_1';

  const first_env: any = {};
  first_env[sample_env_1] = [createTestContainer('container_name_1')];

  const second_env = JSON.parse(JSON.stringify(first_env));
  second_env[sample_env_1].push(createTestContainer('container_name_2'));
  second_env[sample_env_1].push(createTestContainer('container_name_3'));

  const third_env = JSON.parse(JSON.stringify(first_env));
  third_env[sample_env_2] = [createTestContainer('container_name_uno')];

  const fourth_env = { ...JSON.parse(JSON.stringify(third_env)), ...JSON.parse(JSON.stringify(second_env)) };
  fourth_env[sample_env_2].push(createTestContainer('container_name_dos'));
  fourth_env[sample_env_2].push(createTestContainer('container_name_tres'));

  const header = { head: ['Environment', 'Containers', 'Status'] };
  const empty_table = new BaseTable(header);

  const one_env_one_container = new BaseTable(header);
  one_env_one_container.push([sample_env_1, 'container_name_1', 'running']);

  const one_env_many_containers = new BaseTable(header);
  one_env_many_containers.push([sample_env_1, 'container_name_1\ncontainer_name_2\ncontainer_name_3', 'running\nrunning\nrunning']);

  const many_env_one_container = new BaseTable(header);
  many_env_one_container.push([sample_env_1, 'container_name_1', 'running']);
  many_env_one_container.push([sample_env_2, 'container_name_uno', 'running']);

  const many_env_many_containers = new BaseTable(header);
  many_env_many_containers.push([sample_env_1, 'container_name_1\ncontainer_name_2\ncontainer_name_3', 'running\nrunning\nrunning']);
  many_env_many_containers.push([sample_env_2, 'container_name_uno\ncontainer_name_dos\ncontainer_name_tres', 'running\nrunning\nrunning']);

  const default_image_name_env = { 'test_env': [createTestContainer('container_name_not_used', 'image_name_is_used')] };
  const default_image_name_table = new BaseTable(header);
  default_image_name_table.push(['test_env', 'image_name_is_used', 'running']);

  mockArchitectAuth
    .stub(DockerComposeUtils, 'getLocalEnvironmentContainerMap', sinon.stub().returns({}))
    .stub(DevList.prototype, 'log', sinon.fake.returns(null))
    .command(['dev:list'])
    .it('dev list no environments', ctx => {
      const log_spy = DevList.prototype.log as SinonSpy;
      expect(log_spy.firstCall.args[0]).to.equal(empty_table.toString());
    });

  mockArchitectAuth
    .stub(DockerComposeUtils, 'getLocalEnvironmentContainerMap', sinon.stub().returns(first_env))
    .stub(DevList.prototype, 'log', sinon.fake.returns(null))
    .command(['dev:list'])
    .it('dev list environment with one container', ctx => {
      const log_spy = DevList.prototype.log as SinonSpy;
      expect(log_spy.firstCall.args[0]).to.equal(one_env_one_container.toString());
    });

  mockArchitectAuth
    .stub(DockerComposeUtils, 'getLocalEnvironmentContainerMap', sinon.stub().returns(second_env))
    .stub(DevList.prototype, 'log', sinon.fake.returns(null))
    .command(['dev:list'])
    .it('dev list single environment with many containers', ctx => {
      const log_spy = DevList.prototype.log as SinonSpy;
      expect(log_spy.firstCall.args[0]).to.equal(one_env_many_containers.toString());
    });

  mockArchitectAuth
    .stub(DockerComposeUtils, 'getLocalEnvironmentContainerMap', sinon.stub().returns(third_env))
    .stub(DevList.prototype, 'log', sinon.fake.returns(null))
    .command(['dev:list'])
    .it('dev list multiple environments with one container', ctx => {
      const log_spy = DevList.prototype.log as SinonSpy;
      expect(log_spy.firstCall.args[0]).to.equal(many_env_one_container.toString());
    });

  mockArchitectAuth
    .stub(DockerComposeUtils, 'getLocalEnvironmentContainerMap', sinon.stub().returns(fourth_env))
    .stub(DevList.prototype, 'log', sinon.fake.returns(null))
    .command(['dev:list'])
    .it('dev list multiple environments with many containers', ctx => {
      const log_spy = DevList.prototype.log as SinonSpy;
      expect(log_spy.firstCall.args[0]).to.equal(many_env_many_containers.toString());
    });
  
  mockArchitectAuth
    .stub(DockerComposeUtils, 'getLocalEnvironmentContainerMap', sinon.stub().returns(default_image_name_env))
    .stub(DevList.prototype, 'log', sinon.fake.returns(null))
    .command(['dev:list'])
    .it('dev list fallback to image name works', ctx => {
      const log_spy = DevList.prototype.log as SinonSpy;
      expect(log_spy.firstCall.args[0]).to.equal(default_image_name_table.toString());
    });
});
