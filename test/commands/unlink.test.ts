import { expect } from '@oclif/test';
import chalk from 'chalk';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import AppConfig from '../../src/app-config/config';
import CredentialManager from '../../src/app-config/credentials';
import AppService from '../../src/app-config/service';
import Unlink from '../../src/commands/unlink';
import ARCHITECTPATHS from '../../src/paths';

const addition_service_path = path.join(__dirname, '../calculator/addition-service/rest/').toLowerCase().replace(/\/$/, '');

describe('unlink', () => {
  let tmp_dir = os.tmpdir();

  beforeEach(() => {
    const credential_spy = sinon.fake.returns('token');
    sinon.replace(CredentialManager.prototype, 'get', credential_spy);

    // Stub the log_level
    const config = new AppConfig('', {
      log_level: 'info',
    });
    const tmp_linked_services_file = path.join(tmp_dir, ARCHITECTPATHS.LINKED_SERVICE_MAP_FILENAME);
    fs.writeJSONSync(tmp_linked_services_file, {
      'architect/addition-service-rest': addition_service_path,
    });
    const tmp_config_file = path.join(tmp_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);
    const app_config_stub = sinon.stub().resolves(new AppService(tmp_dir));
    sinon.replace(AppService, 'create', app_config_stub);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should fail unlink without service config', async () => {
    const log_spy = sinon.fake.returns(null);
    sinon.replace(Unlink.prototype, 'log', log_spy);

    const bad_path = path.join(__dirname, '../calculator').toLowerCase();
    await Unlink.run([bad_path]);

    expect(log_spy.calledOnce).to.equal(true);
    expect(log_spy.firstCall.args[0]).to.equal(chalk.red(`No linked service found matching, ${bad_path}`));

    const linked_services_file = path.join(tmp_dir, ARCHITECTPATHS.LINKED_SERVICE_MAP_FILENAME);
    const linked_services = fs.readJSONSync(linked_services_file);
    expect(linked_services).to.have.property('architect/addition-service-rest', addition_service_path);
  });

  it('should link service', async () => {
    const log_spy = sinon.fake.returns(null);
    sinon.replace(Unlink.prototype, 'log', log_spy);

    await Unlink.run([addition_service_path]);

    expect(log_spy.calledOnce).to.equal(true);
    expect(log_spy.firstCall.args[0]).to.equal(chalk.green('Successfully unlinked architect/addition-service-rest'));

    const linked_services_file = path.join(tmp_dir, ARCHITECTPATHS.LINKED_SERVICE_MAP_FILENAME);
    const linked_services = fs.readJSONSync(linked_services_file);
    expect(linked_services).not.to.have.property('architect/addition-service-rest');
  });
})
