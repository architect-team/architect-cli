import { expect } from '@oclif/test';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import AppConfig from '../../src/app-config/config';
import CredentialManager from '../../src/app-config/credentials';
import AppService from '../../src/app-config/service';
import Logout from '../../src/commands/logout';
import ARCHITECTPATHS from '../../src/paths';

describe('logout', () => {
  let tmp_dir = os.tmpdir();

  beforeEach(function () {
    sinon.replace(Logout.prototype, 'log', sinon.stub());

    const config = new AppConfig('', {});
    const tmp_config_file = path.join(tmp_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);
    const app_config_stub = sinon.stub().resolves(new AppService(tmp_dir));
    sinon.replace(AppService, 'create', app_config_stub);

    const credential_spy = sinon.fake.returns('token');
    sinon.replace(CredentialManager.prototype, 'get', credential_spy);
  });

  afterEach(function () {
    sinon.restore();
  });

  it('deletes local credentials', async () => {
    const credential_spy = sinon.fake.returns(null);
    sinon.replace(CredentialManager.prototype, 'delete', credential_spy);

    await Logout.run();
    expect(credential_spy.getCalls().length).to.equal(2);
    expect(credential_spy.firstCall.args[0]).to.equal('architect.io');
    expect(credential_spy.secondCall.args[0]).to.equal('architect.io/token');
  });
}).timeout(15000);
