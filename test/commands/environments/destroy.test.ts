import {expect} from '@oclif/test';
import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import sinon from 'sinon';
import moxios from 'moxios';
import EnvironmentDestroy from '../../../src/commands/environments/destroy';
import AppConfig from '../../../src/app-config/config';
import ARCHITECTPATHS from '../../../src/paths';
import AppService from '../../../src/app-config/service';

describe('environment:destroy', () => {
  let tmp_dir = os.tmpdir();

  beforeEach(function() {
    // Stub the log_level
    const config = new AppConfig('', {
      log_level: 'debug',
    });
    const tmp_config_file = path.join(tmp_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);
    const app_config_stub = sinon.stub().resolves(new AppService(tmp_dir));
    sinon.replace(AppService, 'create', app_config_stub);

    sinon.replace(EnvironmentDestroy.prototype, 'log', sinon.stub());
    moxios.install();
  });

  afterEach(function() {
    // Restore stubs
    sinon.restore();
    moxios.uninstall();

    // Remove the registry_host stub
    fs.removeSync(path.join(tmp_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME));
  });

  it('should require an environment name', async () => {
    try {
      await EnvironmentDestroy.run([]);
      expect(true, 'no error thrown').to.equal(false);
    } catch (err) {
      expect(err.message).to.equal('Missing 1 required arg:\nname  Name of the environment to destroy\nSee more help with --help');
    }
  });

  // TODO: determine why moxios doesn't seem to intercept DELETE requests

  // it('should generate destroy deployment', done => {
  //   let environment_name = 'fake-account/test';

  //   sinon.stub(inquirer, 'prompt').resolves({
  //     environment: environment_name,
  //     destroy: true,
  //   });

  //   moxios.stubOnce('DELETE', `/environments/${environment_name}`, {
  //     status: 204,
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

  //   EnvironmentDestroy.run([environment_name]);
  // });

  // it('should force apply destroy job', done => {
  //   let environment_name = 'fake-account/test';

  //   sinon.stub(inquirer, 'prompt').resolves({
  //     environment: environment_name,
  //     destroy: true,
  //   });

  //   moxios.stubOnce('DELETE', `/environments/${environment_name}`, {
  //     status: 204,
  //   });

  //   moxios.wait(function () {
  //     let request = moxios.requests.mostRecent();
  //     const match = request.url.match(/^.*\/environments\/(.*)\?force=1/);
  //     expect(match).not.to.equal(null);
  //     expect(match!.length).to.be.greaterThan(1);
  //     expect(match![1]).to.equal(environment_name);
  //     done();
  //   });

  //   EnvironmentDestroy.run([environment_name, '--force']);
  // });
});
