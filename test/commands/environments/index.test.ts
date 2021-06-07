import { expect } from '@oclif/test';
import fs from 'fs-extra';
import moxios from 'moxios';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import AppConfig from '../../../src/app-config/config';
import AppService from '../../../src/app-config/service';
import Environments from '../../../src/commands/environments';
import ARCHITECTPATHS from '../../../src/paths';

describe('environments', () => {
  let tmp_dir = os.tmpdir();

  beforeEach(function () {
    sinon.replace(Environments.prototype, 'log', sinon.stub());
    moxios.install();

    const config = new AppConfig('', {});
    const tmp_config_file = path.join(tmp_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);
    const app_config_stub = sinon.stub().resolves(new AppService(tmp_dir, '0.0.1'));
    sinon.replace(AppService, 'create', app_config_stub);
  });

  afterEach(function () {
    moxios.uninstall();
    sinon.restore();
  });

  it('lists all environments', done => {
    moxios.stubRequest('/environments', {
      status: 200,
      response: [],
    });

    moxios.wait(function () {
      let request = moxios.requests.mostRecent();
      expect(request.url).to.match(/.*\/environments\?q=/);
      done();
    });

    Environments.run([]);
  });

  it('supports search queries', done => {
    const search_term = 'architect';

    moxios.stubRequest('/environments', {
      status: 200,
      response: [],
    });

    moxios.wait(function () {
      let request = moxios.requests.mostRecent();
      const match = request.url.match(/.*\/environments\?q=(.*)/);
      expect(match).not.to.equal(null);
      expect(match!.length).to.be.greaterThan(1);
      expect(match![1]).to.equal(search_term);
      done();
    });

    Environments.run([search_term]);
  });
})
