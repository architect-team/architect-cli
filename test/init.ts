import dotenv from 'dotenv';
import nock from 'nock';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

nock.disableNetConnect();
nock('https://architect.auth0.com')
      .get('/userinfo')
      .reply(200, { nickname: 'test' });
