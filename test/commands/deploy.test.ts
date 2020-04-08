import { expect } from '@oclif/test';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import AppConfig from '../../src/app-config/config';
import CredentialManager from '../../src/app-config/credentials';
import AppService from '../../src/app-config/service';
import Deploy from '../../src/commands/deploy';
import Link from '../../src/commands/link';
import DockerComposeTemplate, { DockerService } from '../../src/common/docker-compose/template';
import PortUtil from '../../src/common/utils/port';
import ARCHITECTPATHS from '../../src/paths';

const validateComposeFile = (generated_compose: DockerComposeTemplate, expected_compose: DockerComposeTemplate) => {
  expect(generated_compose.version).to.equal(expected_compose.version);

  for (const svc_key of Object.keys(generated_compose.services)) {
    expect(Object.keys(expected_compose.services)).to.include(svc_key);

    const input = generated_compose.services[svc_key] as DockerService;
    const expected = expected_compose.services[svc_key];

    // Expand paths from expected compose templates
    if (expected.build?.context) {
      expected.build.context = path.join(__dirname, '../../', expected.build.context).replace(/\/$/gi, '').toLowerCase();
    }

    if (expected.build?.dockerfile) {
      expected.build.dockerfile = path.join(__dirname, '../../', expected.build.dockerfile).replace(/\/$/gi, '');
    }

    if (expected.volumes) {
      expected.volumes = expected.volumes.map(volume => {
        const [host, target] = volume.split(':');
        return `${path.join(__dirname, '../../', host)}:${target}`;
      });
    }

    if (input.build?.context) {
      input.build.context = input.build.context.replace(/\/$/ig, '').toLowerCase();
    }

    expect(expected.ports).to.have.members(input.ports);
    expect(expected.image).to.equal(input.image);
    expect(expected.depends_on).to.have.members(input.depends_on);
    expect(expected.build).to.eql(input.build);
    expect(expected.command).to.equal(input.command);
    expect(input.environment).not.to.be.undefined;

    // Test env variables
    for (const [key, value] of Object.entries(expected.environment || {})) {
      expect(value).to.equal(input.environment![key]);
    }
  }
};

describe('deploy', () => {
  let tmp_dir = os.tmpdir();

  beforeEach(() => {
    PortUtil.tested_ports = new Set();

    const credential_spy = sinon.fake.returns('token');
    sinon.replace(CredentialManager.prototype, 'get', credential_spy);

    // Stub the log_level
    const config = new AppConfig('', {
      log_level: 'debug',
    });
    const tmp_config_file = path.join(tmp_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);
    const app_config_stub = sinon.stub().resolves(new AppService(tmp_dir));
    sinon.replace(AppService, 'create', app_config_stub);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('generates compose locally', async () => {
    const compose_spy = sinon.fake.resolves(null);
    sinon.replace(Deploy.prototype, 'runCompose', compose_spy);

    // Link the addition service
    const additionServicePath = path.join(__dirname, '../calculator/addition-service/rest');
    await Link.run([additionServicePath]);

    const calculator_env_config_path = path.join(__dirname, '../mocks/calculator-environment-linked-service.json');
    await Deploy.run(['-l', calculator_env_config_path]);

    const expected_compose = fs.readJSONSync(path.join(__dirname, '../mocks/calculator-compose.json')) as DockerComposeTemplate;

    expect(compose_spy.calledOnce).to.equal(true);
    validateComposeFile(compose_spy.firstCall.args[0], expected_compose);
  });

  it('overrides build context and command for deploys', async () => {
    const compose_spy = sinon.fake.resolves(null);
    sinon.replace(Deploy.prototype, 'runCompose', compose_spy);

    // Link the addition service
    const env_config_path = path.join(__dirname, '../mocks/mock-service/arc.env.json');
    await Deploy.run(['-l', env_config_path]);

    const expected_compose = fs.readJSONSync(path.join(__dirname, '../mocks/mock-service/expected-compose.json')) as DockerComposeTemplate;

    expect(compose_spy.calledOnce).to.equal(true);
    validateComposeFile(compose_spy.firstCall.args[0], expected_compose);
  });
});
