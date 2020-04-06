import { expect } from '@oclif/test';
import chalk from 'chalk';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import AppConfig from '../../src/app-config/config';
import CredentialManager from '../../src/app-config/credentials';
import AppService from '../../src/app-config/service';
import Link from '../../src/commands/link';
import ARCHITECTPATHS from '../../src/paths';

describe('link', () => {
  let tmp_dir = os.tmpdir();

  beforeEach(() => {
    const credential_spy = sinon.fake.returns('token');
    sinon.replace(CredentialManager.prototype, 'get', credential_spy);

    // Stub the log_level
    const config = new AppConfig('', {
      log_level: 'info',
    });
    const tmp_config_file = path.join(tmp_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);
    const app_config_stub = sinon.stub().resolves(new AppService(tmp_dir));
    sinon.replace(AppService, 'create', app_config_stub);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should fail link without service config', async () => {
    const log_spy = sinon.fake.returns(null);
    sinon.replace(Link.prototype, 'log', log_spy);

    const bad_path = path.join(__dirname, '../calculator').toLowerCase();
    await Link.run([bad_path]);

    expect(log_spy.calledOnce).to.equal(true);
    expect(log_spy.firstCall.args[0]).to.equal(chalk.red(`No config file found at ${bad_path}/architect.json`));

    const linked_services_file = path.join(tmp_dir, ARCHITECTPATHS.LINKED_SERVICE_MAP_FILENAME);
    if (fs.existsSync(linked_services_file)) {
      const linked_services = fs.readJSONSync(linked_services_file);
      expect(linked_services).not.to.have.property('architect/addition-service-rest');
    }
  });

  it('should link service', async () => {
    const log_spy = sinon.fake.returns(null);
    sinon.replace(Link.prototype, 'log', log_spy);

    const service_path = path.join(__dirname, '../calculator/addition-service/rest/').toLowerCase().replace(/\/$/, '');
    await Link.run([service_path]);

    expect(log_spy.calledOnce).to.equal(true);
    expect(log_spy.firstCall.args[0]).to.equal(`Successfully linked ${chalk.green('architect/addition-service-rest')} to local system at ${chalk.green(service_path)}.`);

    const linked_services_file = path.join(tmp_dir, ARCHITECTPATHS.LINKED_SERVICE_MAP_FILENAME);
    expect(fs.existsSync(linked_services_file)).to.be.true;
    const linked_services = fs.readJSONSync(linked_services_file);
    expect(linked_services).to.have.property('architect/addition-service-rest', service_path);
  });
})
