import path from 'path';
import fs from 'fs-extra';
import axios, { AxiosInstance } from 'axios';
import AppConfig from './config';
import ARCHITECTPATHS from '../paths';
import AuthClient from './auth';
import { AuthenticationClient } from 'auth0';
import LoginRequiredError from '../common/errors/login-required';

export default class AppService {
  config_file = '';
  config: AppConfig;
  auth: AuthClient;
  private _api: AxiosInstance;

  static async create(config_dir: string): Promise<AppService> {
    const service = new AppService(config_dir);
    await service.auth.init();
    return service;
  }

  constructor(config_dir: string) {
    this.config = new AppConfig();
    if (config_dir) {
      this.config_file = path.join(config_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
      if (fs.existsSync(this.config_file)) {
        const payload = fs.readJSONSync(this.config_file);
        this.config = new AppConfig(payload);
      }
    }

    this.auth = new AuthClient(config_dir, new AuthenticationClient({
      domain: this.config.oauth_domain,
      clientId: this.config.oauth_client_id,
    }));
    this._api = axios.create({
      baseURL: this.config.api_host,
    });
  }

  saveConfig() {
    fs.writeFileSync(this.config_file, JSON.stringify(this.config, null, 2));
  }

  get api(): AxiosInstance {
    if (this.auth.auth_results) {
      const { token_type, access_token } = this.auth.auth_results;
      this._api.defaults.headers = {
        Authorization: `${token_type} ${access_token}`,
      };

      const unauthorized_interceptor = this._api.interceptors.response.use(
        res => res,
        async err => {
          if (err.response.status === 401) {
            // Don't repeat the 401 check on a loop
            this._api.interceptors.response.eject(unauthorized_interceptor);

            // Attempt a token refresh
            const new_token = await this.auth.refreshToken();
            if (!new_token) {
              // eslint-disable-next-line no-undef
              return Promise.reject(new LoginRequiredError());
            }

            // Retry the last request with the new token
            this._api.defaults.headers = {
              Authorization: `${new_token.token_type} ${new_token.access_token}`,
            };
            const error_config = err.config;
            error_config.headers.Authorization = this._api.defaults.headers;
            return this._api.request(error_config);
          }

          // eslint-disable-next-line no-undef
          return Promise.reject(new LoginRequiredError());
        }
      );
    }

    return this._api;
  }
}
