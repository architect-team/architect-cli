import { test } from '@oclif/test';
import AuthClient from '../../src/app-config/auth';

export const MOCK_API_HOST = 'http://mock.api.localhost';

export const mockArchitectAuth = test
  .stub(AuthClient.prototype, 'init', () => { })
  .stub(AuthClient.prototype, 'login_from_cli', () => { })
  .stub(AuthClient.prototype, 'generate_browser_url', () => { return 'http://mockurl.com' })
  .stub(AuthClient.prototype, 'login_from_browser', () => { })
  .stub(AuthClient.prototype, 'logout', () => { })
  .stub(AuthClient.prototype, 'dockerLogin', () => { })
  .stub(AuthClient.prototype, 'getToken', () => {
    return {
      account: 'test-user',
      password: 'test-password'
    }
  })
  .stub(AuthClient.prototype, 'refreshToken', () => { })
