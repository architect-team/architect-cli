import { expect } from '@oclif/test';
import fs from 'fs-extra';
import moxios from 'moxios';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import AppConfig from '../../../src/app-config/config';
import AppService from '../../../src/app-config/service';
import EnvironmentUpdate from '../../../src/commands/environments/destroy';
import ARCHITECTPATHS from '../../../src/paths';

describe('environment:update', () => {
  let tmp_dir = os.tmpdir();

  beforeEach(function () {
    // Stub the log_level
    const config = new AppConfig('', {
      log_level: 'debug',
    });
    const tmp_config_file = path.join(tmp_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);
    const app_config_stub = sinon.stub().resolves(new AppService(tmp_dir));
    sinon.replace(AppService, 'create', app_config_stub);

    sinon.replace(EnvironmentUpdate.prototype, 'log', sinon.stub());
    moxios.install();
  });

  afterEach(function () {
    // Restore stubs
    sinon.restore();
    moxios.uninstall();

    // Remove the registry_host stub
    fs.removeSync(path.join(tmp_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME));
  });

  it('should require an environment name', async () => {
    try {
      await EnvironmentUpdate.run([]);
      expect(true, 'no error thrown').to.equal(false);
    } catch (err) {
      expect(err.message).to.equal('Missing 1 required arg:\nenvironment  Name of the environment to destroy\nSee more help with --help');
    }
  });

  // TODO: Determine why moxios won't intercept PUT requests

  // it('should update config', done => {
  //   let environment_name = 'fake-account/test';
  //   let host = '0.0.0.0';

  //   sinon.stub(inquirer, 'prompt').resolves({
  //     name: environment_name,
  //   });

  //   moxios.stubOnce('PUT', `/environments/${environment_name}`, {
  //     status: 200,
  //     response: {},
  //   });

  //   moxios.wait(function () {
  //     let request = moxios.requests.mostRecent();
  //     console.log(request);
  //     const match = request.url.match(/^.*\/environments\/(.*)/);
  //     expect(match).not.to.equal(null);
  //     expect(match!.length).to.be.greaterThan(1);
  //     expect(match![1]).to.equal(environment_name);
  //     done();
  //   });

  //   EnvironmentUpdate.run([environment_name]);
  // });
});
