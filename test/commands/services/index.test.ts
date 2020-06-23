import { expect } from '@oclif/test';
import fs from 'fs-extra';
import moxios from 'moxios';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import AppConfig from '../../../src/app-config/config';
import CredentialManager from '../../../src/app-config/credentials';
import AppService from '../../../src/app-config/service';
import Services from '../../../src/commands/services';
import ARCHITECTPATHS from '../../../src/paths';

describe('services', () => {
  let tmp_dir = os.tmpdir();

  beforeEach(function () {
    sinon.replace(Services.prototype, 'log', sinon.stub());
    moxios.install();

    const config = new AppConfig('', {});
    const tmp_config_file = path.join(tmp_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);
    const app_config_stub = sinon.stub().resolves(new AppService(tmp_dir, '0.0.1'));
    sinon.replace(AppService, 'create', app_config_stub);

    const credential_spy = sinon.fake.returns('token');
    sinon.replace(CredentialManager.prototype, 'get', credential_spy);
  });

  afterEach(function () {
    moxios.uninstall();
    sinon.restore();
  });

  it('lists all services', done => {
    moxios.stubRequest('/services', {
      status: 200,
      response: [],
    });

    moxios.wait(function () {
      let request = moxios.requests.mostRecent();
      expect(request.url).to.match(/.*\/services\?q=/);
      done();
    });

    Services.run([]);
  });

  it('supports search queries', done => {
    const search_term = 'architect';

    moxios.stubRequest('/services', {
      status: 200,
      response: [],
    });

    moxios.wait(function () {
      let request = moxios.requests.mostRecent();
      const match = request.url.match(/.*\/services\?q=(.*)/);
      expect(match).not.to.equal(null);
      expect(match!.length).to.be.greaterThan(1);
      expect(match![1]).to.equal(search_term);
      done();
    });

    Services.run([search_term]);
  });
});
