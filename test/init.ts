import nock from 'nock';
import { AppConfig } from '../src/app-config';
import credentials from '../src/common/credentials';

const disableTTY = require('../src/common/tty');
disableTTY();

const app_config = new AppConfig();

const nock_token = { access_token: 'test' };
const nock_profile = { username: 'test' };

nock.disableNetConnect();
nock(`https://${app_config.oauth_domain}`)
  .get('/userinfo')
  .reply(200, nock_profile)
  .post('/oauth/token')
  .reply(200, nock_token);

credentials.deletePassword = async () => undefined;
credentials.setPassword = async () => undefined;
credentials.findCredential = async () => {
  return { account: 'test', password: JSON.stringify({ ...nock_token, profile: nock_profile }) };
};

exports = credentials;
