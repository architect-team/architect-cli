import { AuthenticationClient } from 'auth0';
import execa from 'execa';
import LoginRequiredError from '../common/errors/login-required';
import AppConfig from './config';
import CredentialManager from './credentials';

export const CREDENTIAL_PREFIX = 'architect.io';

interface AuthResults {
  access_token: string;
  token_type: string;
  expires_in: number;
  issued_at: number;
}

export default class AuthClient {
  config: AppConfig;
  credentials: CredentialManager;
  auth0: AuthenticationClient;
  auth_results?: AuthResults;

  constructor(config: AppConfig, auth0: AuthenticationClient) {
    this.config = config;
    this.credentials = new CredentialManager(config);
    this.auth0 = auth0;
  }

  async init() {
    const token = await this.credentials.get(`${CREDENTIAL_PREFIX}/token`);
    if (token) {
      this.auth_results = JSON.parse(token.password) as AuthResults;
      const expires_at = this.auth_results.issued_at + this.auth_results.expires_in;
      // Refresh the token if its expired to force a docker login
      if (expires_at < (new Date().getTime() / 1000)) {
        await this.refreshToken().catch(() => undefined);
      }
    }
  }

  async login(username: string, password: string) {
    await this.logout();
    await this.credentials.set(CREDENTIAL_PREFIX, username, password);
    const new_token = await this.refreshToken();
    if (!new_token) {
      throw new Error('Login failed');
    }
  }

  async logout() {
    await this.credentials.delete(CREDENTIAL_PREFIX);
    await this.credentials.delete(`${CREDENTIAL_PREFIX}/token`);
  }

  async refreshToken() {
    const credential = await this.credentials.get(CREDENTIAL_PREFIX);
    if (!credential) {
      throw new LoginRequiredError();
    }

    const auth0_results = await this.auth0.passwordGrant({
      realm: 'Username-Password-Authentication',
      username: credential.account,
      password: credential.password,
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      scope: 'openid email',
    }) as AuthResults;

    try {
      // Windows credential manager password max length is 256 chars
      this.auth_results = {
        access_token: auth0_results.access_token,
        token_type: auth0_results.token_type,
        expires_in: auth0_results.expires_in,
        issued_at: new Date().getTime() / 1000,
      };

      await execa('docker', [
        'login', this.config.registry_host,
        '-u', credential.account,
        '--password-stdin',
      ], {
        input: JSON.stringify(this.auth_results),
      });

      await this.credentials.set(`${CREDENTIAL_PREFIX}/token`, credential.account, JSON.stringify(this.auth_results));
      return this.auth_results;
    } catch {
      return undefined;
    }
  }
}
