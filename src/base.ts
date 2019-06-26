import Command from '@oclif/command';
import Config from '@oclif/config';
import { AuthenticationClient } from 'auth0';
import axios, { AxiosRequestConfig, Method } from 'axios';
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

  protected async _getUser(): Promise<UserEntity> {
    const credentials = await keytar.findCredentials('architect.io');
    if (credentials.length === 0) {
      throw Error('`architect login` required');
    }

    const auth0 = new AuthenticationClient({
      domain: this.app_config.oauth_domain,
      clientId: this.app_config.oauth_client_id
    });

    const access_token = JSON.parse(credentials[0].password).access_token;
    const profile = await auth0.getProfile(access_token);

    const user = new UserEntity(access_token, profile.nickname);
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
