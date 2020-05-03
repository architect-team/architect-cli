import { expect } from '@oclif/test';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import AppConfig from '../../src/app-config/config';
import CredentialManager from '../../src/app-config/credentials';
import AppService from '../../src/app-config/service';
import Build from '../../src/commands/build';
import * as DockerUtil from '../../src/common/utils/docker';
import { ServiceConfig, ServiceConfigBuilder } from '../../src/dependency-manager/src';
import ARCHITECTPATHS from '../../src/paths';


const REGISTRY_HOST = 'registry.architect.test';
const TEST_TAG = `test-tag-${Date.now()}`;

const testBuildArgs = (service_path: string, service_config: ServiceConfig, build_args: string[], expected_tag = 'latest') => {
  expect(build_args[0]).to.equal('build');
  build_args = build_args.slice(1);

  expect(build_args[build_args.length - 1]).to.equal(service_path);
  build_args.splice(build_args.length - 1, 1);

  for (let i = 0; i < build_args.length; i++) {
    switch (build_args[i]) {
      case '--build-arg':
        expect(build_args[i + 1]).to.equal(`SERVICE_LANGUAGE=${service_config.getLanguage()}`);
        i++;
        break;
      case '-t':
      case '--tag':
        expect(build_args[i + 1]).to.equal(`${REGISTRY_HOST}/${service_config.getName()}:${expected_tag}`);
        i++;
        break;
      case '--label':
        expect(build_args[i + 1]).to.satisfy((val: string) => val.startsWith('architect.json=') || val.startsWith('api_definitions='));
        if (build_args[i + 1].startsWith('architect.json')) {
          const val = JSON.parse(build_args[i + 1].slice('architect.json='.length));
          expect(service_config.getName()).to.equal(val.name);
        } else {
          const val = JSON.parse(build_args[i + 1].slice('api_definitions='.length));
          if (service_config.getApiSpec() && service_config.getApiSpec().type.toLowerCase() === 'grpc') {
            // TODO: test gRPC api_definitions
          } else {
            expect(Object.keys(val).length).to.equal(0);
          }
        }

        i++;
        break;
    }
  }
};

describe('build', function () {
  this.timeout(15000);

  let tmp_dir = os.tmpdir();
  let spy: sinon.SinonSpy;

  beforeEach(function () {
    // Fake the docker build command
    spy = sinon.fake.returns(null);
    sinon.replace(DockerUtil, 'docker', spy);

    // Stub the logger
    sinon.replace(Build.prototype, 'log', sinon.stub());

    // Stub the registry_host
    const config = new AppConfig(__dirname, {
      registry_host: REGISTRY_HOST,
    });
    const tmp_config_file = path.join(tmp_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);
    const app_config_stub = sinon.stub().resolves(new AppService(tmp_dir));
    sinon.replace(AppService, 'create', app_config_stub);

    const credential_spy = sinon.fake.returns('token');
    sinon.replace(CredentialManager.prototype, 'get', credential_spy);
  });

  afterEach(function () {
    // Restore stubs
    sinon.restore();

    // Remove the registry_host stub
    fs.removeSync(path.join(tmp_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME));
  });

  it('builds docker image', async () => {
    const service_path = path.join(__dirname, '../calculator/addition-service/rest');
    const service_config = await ServiceConfigBuilder.buildFromPath(service_path);
    await Build.run(['-s', service_path]);

    expect(spy.calledOnce).to.equal(true);
    testBuildArgs(service_path, service_config, spy.getCall(0).args[0]);
  });

  it('builds gRPC docker image', async () => {
    const service_path = path.join(__dirname, '../calculator/addition-service/grpc/add.architect.json');
    const service_config = await ServiceConfigBuilder.buildFromPath(service_path);
    await Build.run(['-s', service_path]);

    expect(spy.calledOnce).to.equal(true);
    testBuildArgs(service_path.endsWith('.json') ? path.dirname(service_path) : service_path, service_config, spy.getCall(0).args[0]);
  });

  it('builds docker image w/ specific tag', async () => {
    const service_path = path.join(__dirname, '../calculator/addition-service/grpc/add.architect.json');
    const service_config = await ServiceConfigBuilder.buildFromPath(service_path);
    await Build.run(['-s', service_path, '-t', TEST_TAG]);

    expect(spy.calledOnce).to.equal(true);
    testBuildArgs(service_path.endsWith('.json') ? path.dirname(service_path) : service_path, service_config, spy.getCall(0).args[0], TEST_TAG);
  });

  it('builds local images from environment config', async () => {
    const env_config_path = path.join(__dirname, '../calculator/arc.env.json');
    await Build.run(['-e', env_config_path]);

    expect(spy.callCount).to.equal(3);
    for (const call of spy.getCalls()) {
      const service_path = call.args[0][call.args[0].length - 1];
      let service_file = service_path;
      // hack to get tests to pass
      if (service_file.endsWith('grpc')) {
        service_file = path.join(service_file, 'add.architect.json');
      }
      const service_config = await ServiceConfigBuilder.buildFromPath(service_file);
      testBuildArgs(service_path, service_config, call.args[0]);
    }
  });
});
