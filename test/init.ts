import keytar from 'keytar';
import nock from 'nock';
import { AppConfig } from '../src/app-config';

const app_config = new AppConfig();

const nock_token = { access_token: 'test' };
const nock_profile = { nickname: 'test' };

nock.disableNetConnect();
nock(`https://${app_config.oauth_domain}`)
  .get('/userinfo')
  .reply(200, nock_profile)
  .post('/oauth/token')
  .reply(200, nock_token);

keytar.deletePassword = async () => true;
keytar.setPassword = async () => undefined;
keytar.findCredentials = async () => [{ account: 'test', password: JSON.stringify({ ...nock_token, profile: nock_profile }) }];
exports = keytar;
