
import { AuthenticationClient } from 'auth0';
import axios, { AxiosRequestConfig, Method } from 'axios';
import execa from 'execa';
import url from 'url';
import { AppConfig } from '../app-config';
import credentials from './credentials';


class UserEntity {
  readonly access_token: string;
  readonly username: string;

  constructor(access_token: string, username: string) {
    this.access_token = access_token;
    this.username = username;
  }
}

export default class ArchitectClient {
  protected readonly app_config: AppConfig;
  protected _user?: Promise<UserEntity>;

  constructor(app_config: AppConfig) {
    this.app_config = app_config;
  }

  async login(username: string, password: string) {
    await this.logout();
    await credentials.setPassword('architect.io', username, password);
    await this.refreshToken();
  }

  async logout() {
    await credentials.deletePassword('architect.io');
    await credentials.deletePassword('architect.io/token');
  }

  async getUser(): Promise<UserEntity> {
    if (!this._user) {
      this._user = this._getUser();
    }
    return this._user;
  }

  async get(path: string, options?: AxiosRequestConfig) {
    return this.request('GET', path, options);
  }

  async put(path: string, options?: AxiosRequestConfig) {
    return this.request('PUT', path, options);
  }

  async delete(path: string, options?: AxiosRequestConfig) {
    return this.request('DELETE', path, options);
  }

  async post(path: string, options?: AxiosRequestConfig) {
    return this.request('POST', path, options);
  }

  async refreshToken() {
    const registry_domain = this.app_config.default_registry_host;

    const auth0 = new AuthenticationClient({
      domain: this.app_config.oauth_domain,
      clientId: this.app_config.oauth_client_id,
    });

    const credential = await credentials.findCredential('architect.io');
    if (!credential) {
      throw Error('`architect login` required');
    }

    const username = credential.account;
    const issued_at = new Date().getTime() / 1000;

    const auth_result = await auth0.passwordGrant({
      realm: 'Username-Password-Authentication',
      username,
      password: credential.password,
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      scope: 'openid profile',
    });

    await execa('docker', ['login', registry_domain, '-u', username, '--password-stdin'], { input: JSON.stringify(auth_result) });

    const profile = await auth0.getProfile(auth_result.access_token);
    auth_result.profile = profile;
    auth_result.issued_at = issued_at;
    await credentials.setPassword('architect.io/token', username, JSON.stringify(auth_result));
    return auth_result;
  }

  async getToken() {
    const credential = await credentials.findCredential('architect.io/token');
    if (!credential) {
      return;
    }
    let auth = JSON.parse(credential.password);
    if ((auth.issued_at + auth.expires_in) < new Date().getTime() / 1000) {
      auth = await this.refreshToken();
    }
    return auth;
  }

  protected async _getUser(): Promise<UserEntity> {
    const auth = await this.getToken();
    if (!auth) {
      throw Error('`architect login` required');
    }
    const user = new UserEntity(auth.access_token, auth.profile['https://architect.io/username']);
    if (!user.username) {
      throw Error('`architect login` required');
    }
    return user;
  }

  protected async request(method: Method, path: string, options?: AxiosRequestConfig) {
    const user = await this.getUser();
    const access_token = user.access_token;

    const base_options = {
      url: url.resolve(this.app_config.api_host, path),
      headers: {
        authorization: `Bearer ${access_token}`,
      },
      method,
    };
    options = { ...base_options, ...(options || {}) };

    return axios(options).catch(err => {
      if (err.response && err.response.status === 401) {
        err = new Error('`architect login` required');
      }
      throw err;
    });
  }
}
