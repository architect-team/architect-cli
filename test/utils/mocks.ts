import { test } from '@oclif/test';
import AuthClient from '../../src/app-config/auth';
import { DockerComposeUtils } from '../../src/common/docker-compose';
import * as Docker from '../../src/common/utils/docker';

export const MOCK_API_HOST = 'http://mock.api.localhost';

export const mockArchitectAuth = test
  .stub(AuthClient.prototype, 'init', () => { })
  .stub(AuthClient.prototype, 'loginFromCli', () => { })
  .stub(AuthClient.prototype, 'generateBrowserUrl', () => { return 'http://mockurl.com' })
  .stub(AuthClient.prototype, 'loginFromBrowser', () => { })
  .stub(AuthClient.prototype, 'logout', () => { })
  .stub(AuthClient.prototype, 'dockerLogin', () => { })
  .stub(AuthClient.prototype, 'getToken', () => {
    return {
      account: 'test-user',
      password: 'test-password'
    }
  })
  .stub(AuthClient.prototype, 'refreshToken', () => { })
  .stub(Docker, 'verify', () => { })
  .stub(DockerComposeUtils, 'dockerCompose', () => { })
  .stub(DockerComposeUtils, 'writeCompose', () => { })
