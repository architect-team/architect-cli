process.env.CI = 'true'
import mock_fs from 'mock-fs';
import nock from 'nock';
import 'reflect-metadata';
import sinon from 'sinon';
import CredentialManager from '../src/app-config/credentials';
import PortUtil from '../src/common/utils/port';
import PromptUtils from '../src/common/utils/prompt-utils';

PromptUtils.disable_prompts();

for (const env_key of Object.keys(process.env)) {
  if (env_key.startsWith('ARC_')) {
    delete process.env[env_key];
  }
}
process.env.ARCHITECT_CONFIG_DIR = './test'
process.env.NODE_ENV = 'test'

CredentialManager.prototype.get = async (service: string) => {
  return {
    account: 'test',
    password: '{}'
  }
}

exports.mochaHooks = {
  beforeEach(done: any) {
    nock.disableNetConnect();
    nock('localhost').get('/v1/auth/approle/login').reply(200, { auth: {} });

    sinon.replace(PortUtil, 'isPortAvailable', async () => true);
    PortUtil.reset();
    done();
  },

  afterEach(done: any) {
    sinon.restore();
    mock_fs.restore();
    nock.enableNetConnect();
    done();
  }
}
