import nock from 'nock';

import { AppConfig } from '../src/app-config';
const app_config = new AppConfig();

nock.disableNetConnect();
nock(`https://${app_config.oauth_domain}`)
      .get('/userinfo')
      .reply(200, { nickname: 'test' });
