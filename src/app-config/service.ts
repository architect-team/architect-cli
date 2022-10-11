import axios, { AxiosInstance } from 'axios';
import fs from 'fs-extra';
import https from 'https';
import os from 'os';
import path from 'path';
import { URL } from 'url';
import { Dictionary } from '../';
import User from '../architect/user/user.entity';
import LoginRequiredError from '../common/errors/login-required';
import LocalPaths from '../paths';
import AuthClient from './auth';
import AppConfig from './config';

export default class AppService {
  config: AppConfig;
  auth: AuthClient;
  linkedComponents: Dictionary<string> = {};
  _api: AxiosInstance;
  version: string;
  errorContext?: Error;

  static create(config_dir: string, version: string): AppService {
    return new AppService(config_dir, version);
  }

  constructor(config_dir: string, version: string) {
    this.config = new AppConfig(config_dir);
    this.version = version;
    if (config_dir) {
      const config_file = path.join(config_dir, LocalPaths.CLI_CONFIG_FILENAME);
      if (fs.existsSync(config_file)) {
        const payload = fs.readJSONSync(config_file);
        this.config = new AppConfig(config_dir, payload);
      }
    }

    this._api = axios.create({
      baseURL: this.config.api_host,
      timeout: 10000,
      headers: {
        'Cli-Version': this.version,
        'User-Agent': `architect/cli ${this.version} ${os.platform()} ${os.type()}/${os.release()}`,
      },
    });

    const url = new URL(this.config.api_host);

    // Set HOST header for local dev
    if (url.hostname.endsWith('.localhost') && process.env.TEST !== '1') {
      this._api.defaults.baseURL = `${url.protocol}//localhost:${url.port || (url.protocol === 'http:' ? 80 : 443)}${url.pathname}`;
      this._api.defaults.headers.HOST = url.hostname;
      this._api.defaults.httpsAgent = new https.Agent({
        rejectUnauthorized: false,
      });
    }

    this.auth = new AuthClient(this.config, this.checkLogin.bind(this));

    this.linkedComponents = this.loadLinkedComponents(config_dir);
  }

  private loadLinkedComponents(config_dir: string) {
    const linkedComponentsFile = path.join(config_dir, LocalPaths.LINKED_COMPONENT_MAP_FILENAME);
    if (!fs.existsSync(linkedComponentsFile)) {
      return {};
    }
    try {
      return fs.readJSONSync(linkedComponentsFile) as Dictionary<string>;
    } catch {
      console.warn('Failed to read linked components file.');
      return {};
    }
  }

  private saveLinkedComponents() {
    const linkedComponentsFile = path.join(this.config.getConfigDir(), LocalPaths.LINKED_COMPONENT_MAP_FILENAME);
    fs.writeJSONSync(linkedComponentsFile, this.linkedComponents, { spaces: 2 });
  }

  linkComponentPath(componentName: string, componentPath: string): void {
    this.linkedComponents[componentName] = componentPath;
    this.saveLinkedComponents();
  }

  unlinkComponent(componentNameOrPath: string): string | undefined {
    let res;

    if (componentNameOrPath in this.linkedComponents) {
      delete this.linkedComponents[componentNameOrPath];
      res = componentNameOrPath;
    } else {
      this.linkedComponents = Object.entries(this.linkedComponents).reduce((linkedComponents, [componentName, componentPath]) => {
        if (componentPath !== componentNameOrPath) {
          linkedComponents[componentName] = componentPath;
        } else {
          res = componentName;
        }

        return linkedComponents;
      }, {} as Dictionary<string>);
    }

    this.saveLinkedComponents();
    return res;
  }

  unlinkAllComponents(): void {
    this.linkedComponents = {};
    this.saveLinkedComponents();
  }

  saveConfig(): void {
    this.config.save();
  }

  async checkLogin(): Promise<User> {
    const { data } = await this.api.get('/users/me');
    return data;
  }

  get api(): AxiosInstance {
    const token_json = this.auth._auth_result;
    if (token_json) {
      const { token_type, access_token } = token_json;
      this._api.defaults.headers = {
        ...this._api.defaults.headers,
        Authorization: `${token_type} ${access_token}`,
      };
      const unauthorized_interceptor = this._api.interceptors.response.use(
        res => res,
        async err => {
          if (err?.response?.status === 401) {
            // Don't repeat the 401 check on a loop
            this._api.interceptors.response.eject(unauthorized_interceptor);

            // Attempt a token refresh
            const new_token = await this.auth.refreshToken().catch(() => undefined);
            if (!new_token) {
              return Promise.reject(new LoginRequiredError());
            }
            // Retry the last request with the new token
            this._api.defaults.headers = {
              ...this._api.defaults.headers,
              Authorization: `${new_token.token.token_type} ${new_token.token.access_token}`,
            };
            const error_config = err.config;
            error_config.headers.Authorization = this._api.defaults.headers.Authorization;
            return this._api.request(error_config);
          }

          if (this.errorContext?.stack) {
            err.stack = `${err.stack}\n${this.errorContext.stack.substring(7)}`;
          }
          // Note: it is okay to rethrow these errors as they are here because the catch block in the basecommand.ts should correctly interpret axios errors.
          throw err;
        },
      );
    }

    return this._api;
  }
}
