import Command from '@oclif/command';
import Config from '@oclif/config';
import { AuthenticationClient } from 'auth0';
import axios, { AxiosRequestConfig, Method } from 'axios';
import execa from 'execa';
import keytar from 'keytar';
import Listr from 'listr';
import url from 'url';
import { AppConfig } from './app-config';

export default abstract class ArchitectCommand extends Command {
  static async tasks(this: any, argv?: string[], opts?: Config.LoadOptions): Promise<Listr.ListrTask[]> {
    if (!argv) argv = process.argv.slice(2);
    const config = await Config.load(opts || module.parent && module.parent.parent && module.parent.parent.filename || __dirname);
    let cmd = new this(argv, config);
    return cmd._tasks(argv);
  }
  protected static app_config: AppConfig;
  protected static architect: ArchitectClient;

  app_config!: AppConfig;
  architect!: ArchitectClient;

  async init() {
    if (!ArchitectCommand.app_config) {
      ArchitectCommand.app_config = new AppConfig();
    }
    this.app_config = ArchitectCommand.app_config;

    if (!ArchitectCommand.architect) {
      ArchitectCommand.architect = new ArchitectClient(this.app_config);
    }
    this.architect = ArchitectCommand.architect;
  }

  async catch(err: any) {
    if (err.oclif && err.oclif.exit === 0) return;
    if (err.response && err.response.data) {
      this.styled_json(err.response.data);
    }
    if (this.app_config && this.app_config.debug) {
      throw err;
    } else {
      this.error(err.message || err);
    }
  }

  async tasks(): Promise<Listr.ListrTask[]> { throw Error('Not implemented'); }

  async _tasks(): Promise<Listr.ListrTask[] | undefined> {
    let err: Error | undefined;
    try {
      // remove redirected env var to allow subsessions to run autoupdated client
      delete process.env[this.config.scopedEnvVarKey('REDIRECTED')];

      await this.init();
      return await this.tasks();
    } catch (e) {
      err = e;
      await this.catch(e);
    } finally {
      await this.finally(err);
    }
  }

  styled_json(obj: object) {
    let json = JSON.stringify(obj, null, 2);
    this.log(json);
  }
}

class UserEntity {
  readonly access_token: string;
  readonly username: string;

  constructor(access_token: string, username: string) {
    this.access_token = access_token;
    this.username = username;
  }
}

class ArchitectClient {
  protected readonly app_config: AppConfig;
  protected _user?: Promise<UserEntity>;

  constructor(app_config: AppConfig) {
    this.app_config = app_config;
  }

  async login(username: string, password: string) {
    this.logout();
    await keytar.setPassword('architect.io', username, password);
    await this.refreshToken();
  }

  async logout() {
    for (const credential of await keytar.findCredentials('architect.io')) {
      await keytar.deletePassword('architect.io', credential.account);
    }
    for (const credential of await keytar.findCredentials('architect.io/token')) {
      await keytar.deletePassword('architect.io/token', credential.account);
    }
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
      clientId: this.app_config.oauth_client_id
    });

    const credentials = await keytar.findCredentials('architect.io');
    if (credentials.length === 0) {
      throw Error('`architect login` required');
    }

    const username = credentials[0].account;
    const issued_at = new Date().getTime() / 1000;
    const auth_result = await auth0.passwordGrant({
      realm: 'Username-Password-Authentication',
      username,
      password: credentials[0].password,
      scope: 'openid profile'
    });

    await execa('docker', ['login', registry_domain, '-u', username, '--password-stdin'], { input: JSON.stringify(auth_result) });

    const profile = await auth0.getProfile(auth_result.access_token);
    auth_result.profile = profile;
    auth_result.issued_at = issued_at;
    await keytar.setPassword('architect.io/token', username, JSON.stringify(auth_result));
    return auth_result;
  }

  protected async _getUser(): Promise<UserEntity> {
    const credentials = await keytar.findCredentials('architect.io/token');
    if (credentials.length === 0) {
      throw Error('`architect login` required');
    }
    let auth = JSON.parse(credentials[0].password);
    if ((auth.issued_at + auth.expires_in) < new Date().getTime() / 1000) {
      auth = await this.refreshToken();
    }

    const user = new UserEntity(auth.access_token, auth.profile.nickname);
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
      method
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
