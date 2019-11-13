import {expect, test} from '@oclif/test';
import Uninstall from '../../src/commands/uninstall';
import sinon from 'sinon';
import os from 'os';
import fs from 'fs-extra';
import path from 'path';
import AppConfig from '../../src/app-config/config';
import ARCHITECTPATHS from '../../src/paths';
import AppService from '../../src/app-config/service';

describe('uninstall', () => {
  let tmp_dir = os.tmpdir();

  beforeEach(function() {
    // Stub the log_level
    const config = new AppConfig({
      log_level: 'debug',
    });
    const tmp_config_file = path.join(tmp_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);
    const app_config_stub = sinon.stub().resolves(new AppService(tmp_dir));
    sinon.replace(AppService, 'create', app_config_stub);
  });

  afterEach(function() {
    // Restore stubs
    sinon.restore();

    // Remove the registry_host stub
    fs.removeSync(path.join(tmp_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME));
  });

  it('fails missing dependency', async () => {
    try {
      await Uninstall.run([]);
      expect(false, 'no error thrown').to.equal(true);
    } catch (err) {
      expect(err.name).to.equal('missing_dependency');
      expect(err.message).to.equal('No dependency name provided');
    }
  });

  it('fails on invalid service directory', async () => {
    try {
      await Uninstall.run(['architect/addition-service', '-s', __dirname]);
      expect(false, 'no error thrown').to.equal(true);
    } catch (err) {
      expect(err.name).to.equal('missing_config_file');
      expect(err.message).to.equal(`No config file found at ${path.join(__dirname, ARCHITECTPATHS.SERVICE_CONFIG_FILENAME)}`);
    }
  });

  it('skips nonexistant dependency', async () => {
    const log_spy = sinon.fake.returns(null);
    sinon.replace(Uninstall.prototype, 'log', log_spy);

    const subtraction_service = path.join(__dirname, '../calculator/subtraction-services/node/rest');
    await Uninstall.run(['fake-service', '-s', subtraction_service]);
    expect(log_spy.calledOnce).to.equal(true);
    expect(log_spy.firstCall.args[0]).to.equal('architect/subtraction-service does not have fake-service as a dependency. Skipping.');
  });

  it('successfully removes dependency', async () => {
    // Stub the logger
    sinon.replace(Uninstall.prototype, 'log', sinon.stub());

    // Spy on the call to save the service config
    const save_spy = sinon.fake.returns(null);
    sinon.replace(Uninstall.prototype, 'saveServiceConfig', save_spy);

    const subtraction_service = path.join(__dirname, '../calculator/subtraction-services/node/rest');
    const subtraction_config = fs.readJSONSync(path.join(subtraction_service, ARCHITECTPATHS.SERVICE_CONFIG_FILENAME));
    await Uninstall.run(['architect/addition-service', '-s', subtraction_service]);
    expect(save_spy.calledOnce).to.equal(true);
    expect(save_spy.firstCall.args[0]).to.equal(subtraction_service);

    const input_config = save_spy.firstCall.args[1];
    delete subtraction_config.dependencies['architect/addition-service'];
    expect(input_config.name).to.equal(subtraction_config.name);
    expect(input_config.dependencies).eql(subtraction_config.dependencies);
  });
});
