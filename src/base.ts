import Command from '@oclif/command';
import * as Config from '@oclif/config';
import * as keytar from 'keytar';
import * as Listr from 'listr';
import * as request from 'request';
import * as url from 'url';

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
      ArchitectCommand.architect = new ArchitectClient(ArchitectCommand.app_config.api_host);
    }
    this.app_config = ArchitectCommand.app_config;
    this.architect = ArchitectCommand.architect;
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

  constructor(partial: { [key: string]: string }) {
    this.access_token = partial.access_token;
    this.username = partial['https://architect.io/username'];
  }
}

class ArchitectClient {
  private readonly domain: string;

  constructor(domain: string) {
    this.domain = domain;
  }

  async getUser() {
    const credentials = await keytar.findCredentials('architect.io');
    if (credentials.length === 0) {
      throw Error('denied: `architect login` required');
    }
    const user = new UserEntity(JSON.parse(credentials[0].password));
    if (!user.username) {
      throw Error('denied: `architect login` required');
    }
    return user;
  }

  async get(path: string) {
    return this.request('GET', path);
  }

  async put(path: string, body: object) {
    return this.request('PUT', path, body);
  }

  async delete(path: string) {
    return this.request('DELETE', path);
  }

  async post(path: string, body: object) {
    return this.request('POST', path, body);
  }

  private async request(method: string, path: string, body?: object) {
    const credentials = await keytar.findCredentials('architect.io');
    if (credentials.length === 0) {
      throw Error('denied: `architect login` required');
    }
    const user = await this.getUser();
    const access_token = user.access_token;

    const options = {
      url: url.resolve(this.domain, path),
      headers: {
        authorization: `Bearer ${access_token}`,
        method,
      },
      json: true,
      method,
      body
    };

    return new Promise<request.Response>((resolve, reject) => {
      request(options, (err, res) => {
        if (err) {
          reject(err);
        } else {
          if (res.statusCode < 400) {
            resolve(res);
          } else {
            if (res.statusCode === 401) {
              reject(Error('denied: `architect login` required'));
            } else {
              let json;
              try {
                json = JSON.stringify(res.body, null, 2);
              } catch {
                json = '';
              }
              reject(new Error(`failed: request ${res.statusCode} ${res.statusMessage} ${json}`));
            }
          }
        }
      });
    });
  }
}
