import { AuthenticationClient } from 'auth0';
import LoginRequiredError from '../common/errors/login-required';
import { docker } from '../common/utils/docker';
import AppConfig from './config';
import CredentialManager from './credentials';

const CREDENTIAL_PREFIX = 'architect.io';

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
    await this.credentials.init();
    const token = await this.getToken();
    if (token && token.account !== 'unknown') {
      this.auth_results = JSON.parse(token.password) as AuthResults;
      const expires_at = this.auth_results.issued_at + this.auth_results.expires_in;
      // Refresh the token if its expired to force a docker login
      if (expires_at < (new Date().getTime() / 1000)) {
        await this.refreshToken().catch(() => undefined);
      }
    } else if (!token) {
      try {
        await docker([
          'login', this.config.registry_host,
          '-u', 'unknown',
          '--password-stdin',
        ], { stdout: false }, {
          input: 'unknown',
        });
      } catch {
        // docker is required, but not truly necessary here
      }
      await this.credentials.set(CREDENTIAL_PREFIX, 'unknown', 'unknown');
      await this.credentials.set(`${CREDENTIAL_PREFIX}/token`, 'unknown', 'unknown');
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
    try {
      await docker(['logout', this.config.registry_host], { stdout: false });
    } catch{
      // docker is required, but not truly necessary here
    }
  }

  async getToken() {
    return this.credentials.get(`${CREDENTIAL_PREFIX}/token`);
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

    // Windows credential manager password max length is 256 chars
    this.auth_results = {
      access_token: auth0_results.access_token,
      token_type: auth0_results.token_type,
      expires_in: auth0_results.expires_in,
      issued_at: new Date().getTime() / 1000,
    };

    await docker([
      'login', this.config.registry_host,
      '-u', credential.account,
      '--password-stdin',
    ], { stdout: false }, {
      input: this.auth_results.access_token,
    });

    await this.credentials.set(`${CREDENTIAL_PREFIX}/token`, credential.account, JSON.stringify(this.auth_results));
    return this.auth_results;
  }
}
