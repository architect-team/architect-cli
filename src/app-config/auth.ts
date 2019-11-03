import { AuthenticationClient } from 'auth0';
import CredentialManager from './credentials';
import LoginRequiredError from '../common/errors/login-required';
import execa from 'execa';

const CREDENTIAL_PREFIX = 'architect.io';

interface AuthResults {
  access_token: string;
  token_type: string;
  expires_in: number;
  issued_at?: number;
  profile?: any;
}

export default class AuthClient {
  credentials: CredentialManager;
  auth0: AuthenticationClient;
  auth_results?: AuthResults;

  constructor(config_dir: string, auth0: AuthenticationClient) {
    this.credentials = new CredentialManager(config_dir);
    this.auth0 = auth0;
  }

  async login(username: string, password: string) {
    await this.logout();
    await this.credentials.set(CREDENTIAL_PREFIX, username, password);
    await this.refreshToken();
  }

  async logout() {
    await this.credentials.delete(CREDENTIAL_PREFIX);
    await this.credentials.delete(`${CREDENTIAL_PREFIX}/token`);
  }

  async getToken() {
    if (!this.auth_results) {
      await this.refreshToken();
    }

    return this.auth_results;
  }

  async refreshToken() {
    const credential = await this.credentials.get(CREDENTIAL_PREFIX);
    if (!credential) {
      throw new LoginRequiredError();
    }

    this.auth_results = await this.auth0.passwordGrant({
      realm: 'Username-Password-Authentication',
      username: credential.account,
      password: credential.password,
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      scope: 'openid profile email',
    }) as AuthResults;

    try {
      await execa('docker', [
        'login',
        '-u', credential.account,
        '--password-stdin',
      ], {
        input: JSON.stringify(this.auth_results),
      });

      const profile = await this.auth0.getProfile(this.auth_results.access_token);
      this.auth_results.profile = profile;
      this.auth_results.issued_at = new Date().getTime() / 1000;
      await this.credentials.set(`${CREDENTIAL_PREFIX}/token`, credential.account, JSON.stringify(this.auth_results));
      return this.auth_results;
    } catch (error) {
      return undefined;
    }
  }
}
