import {expect, test} from '@oclif/test';
import path from 'path';
import sinon from 'sinon';
import fs from 'fs-extra';
import ServiceConfig from '../../src/common/service-config';
import Build from '../../src/commands/build';
import { execSync } from 'child_process';
import { plainToClass } from 'class-transformer';

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
        expect(build_args[i + 1]).to.equal(`SERVICE_LANGUAGE=${service_config.language}`);
        i++;
        break;
      case '-t':
      case '--tag':
        expect(build_args[i + 1]).to.equal(`${REGISTRY_HOST}/${service_config.name}:${expected_tag}`);
        i++;
        break;
      case '--label':
        expect(build_args[i + 1]).to.satisfy((val: string) => val.startsWith('architect.json=') || val.startsWith('api_definitions='));
        if (build_args[i + 1].startsWith('architect.json')) {
          const val = JSON.parse(build_args[i + 1].slice('architect.json='.length));
          expect(service_config.name).to.equal(val.name);
        } else {
          const val = JSON.parse(build_args[i + 1].slice('api_definitions='.length));
          if (service_config.api && service_config.api.type.toLowerCase() === 'grpc') {
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

describe('build', function() {
  this.timeout(15000);

  let original_registry_host: string;
  let spy: sinon.SinonSpy;

  before(function() {
    // Set a predictable registry_host
    original_registry_host = execSync(`npx architect config:get registry_host`).toString();
    execSync(`npx architect config:set registry_host ${REGISTRY_HOST}`);
  });

  after(function() {
    // Restory registry_host
    execSync(`npx architect config:set registry_host ${original_registry_host}`);
  });

  beforeEach(function() {
    // Fake the docker build command
    spy = sinon.fake.returns(null);
    sinon.replace(Build.prototype, 'docker', spy);
    sinon.replace(Build.prototype, 'log', sinon.stub());
  });

  afterEach(function() {
    // Restore stubs
    sinon.restore();
  });

  it('builds docker image', async () => {
    const service_path = path.join(__dirname, '../calculator/addition-service/rest');
    let service_config = fs.readJsonSync(path.join(service_path, 'architect.json'));
    service_config = plainToClass(ServiceConfig, service_config);
    await Build.run(['-s', service_path]);

    // expect(stdout).to.contain('Building docker image for architect/addition-service');
    expect(spy.calledOnce).to.equal(true);
    testBuildArgs(service_path, service_config, spy.getCall(0).args[0]);
  });

  it('builds gRPC docker image', async () => {
    const service_path = path.join(__dirname, '../calculator/addition-service/grpc');
    let service_config = fs.readJsonSync(path.join(service_path, 'architect.json'));
    service_config = plainToClass(ServiceConfig, service_config);
    await Build.run(['-s', service_path]);

    // expect(stdout).to.contain('Building docker image for architect/addition-service');
    expect(spy.calledOnce).to.equal(true);
    testBuildArgs(service_path, service_config, spy.getCall(0).args[0]);
  });

  it('builds docker image w/ specific tag', async () => {
    const service_path = path.join(__dirname, '../calculator/addition-service/grpc');
    let service_config = fs.readJsonSync(path.join(service_path, 'architect.json'));
    service_config = plainToClass(ServiceConfig, service_config);
    await Build.run(['-s', service_path, '-t', TEST_TAG]);

    // expect(stdout).to.contain('Building docker image for architect/addition-service');
    expect(spy.calledOnce).to.equal(true);
    testBuildArgs(service_path, service_config, spy.getCall(0).args[0], TEST_TAG);
  });

  it('builds images recursively', async () => {
    const root_service_path = path.join(__dirname, '../calculator/division-service');
    await Build.run(['-s', root_service_path, '-r']);

    expect(spy.callCount).to.equal(3);
    for (const call of spy.getCalls()) {
      const service_path = call.args[0][call.args[0].length - 1];
      let service_config = fs.readJsonSync(path.join(service_path, 'architect.json'));
      service_config = plainToClass(ServiceConfig, service_config);
      testBuildArgs(service_path, service_config, call.args[0]);
    }
  });

  // test
  //   .stdout()
  //   .command(['build', '-s', './test/calculator/division-service', '-r'])
  //   .timeout(30000)
  //   .it('builds images recursively', ctx => {
  //     expect(ctx.stdout).to.contain('Building docker image for architect/addition-service');
  //     expect(ctx.stdout).to.contain('Building docker image for architect/subtraction-service');
  //     expect(ctx.stdout).to.contain('Building docker image for architect/division-service');

  //     const addition_image = execSync(`docker images ${REGISTRY_HOST}/architect/addition-service:latest`);
  //     expect(addition_image.toString()).to.contain(`${REGISTRY_HOST}/architect/addition-service`);

  //     const subtraction_image = execSync(`docker images ${REGISTRY_HOST}/architect/subtraction-service:latest`);
  //     expect(subtraction_image.toString()).to.contain(`${REGISTRY_HOST}/architect/addition-service`);

  //     const division_image = execSync(`docker images ${REGISTRY_HOST}/architect/division-service:latest`);
  //     expect(division_image.toString()).to.contain(`${REGISTRY_HOST}/architect/division-service`);
  //   });
});
