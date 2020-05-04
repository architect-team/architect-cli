import { AuthenticationClient } from 'auth0';
import axios, { AxiosInstance } from 'axios';
import fs from 'fs-extra';
import path from 'path';
import LoginRequiredError from '../common/errors/login-required';
import ARCHITECTPATHS from '../paths';
import AuthClient from './auth';
import AppConfig from './config';

declare type LinkedServicesMap = { [serviceName: string]: string };

export default class AppService {
  config: AppConfig;
  auth: AuthClient;
  linkedServices: LinkedServicesMap = {};
  _api: AxiosInstance;

  static async create(config_dir: string): Promise<AppService> {
    const service = new AppService(config_dir);
    await service.auth.init();
    return service;
  }

  constructor(config_dir: string) {
    this.config = new AppConfig(config_dir);
    if (config_dir) {
      const config_file = path.join(config_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
      if (fs.existsSync(config_file)) {
        const payload = fs.readJSONSync(config_file);
        this.config = new AppConfig(config_dir, payload);
      }
    }

    this.auth = new AuthClient(this.config, new AuthenticationClient({
      domain: this.config.oauth_domain,
      clientId: AuthClient.CLIENT_ID,
    }));
    this._api = axios.create({
      baseURL: this.config.api_host,
    });

    const linkedServicesFile = path.join(config_dir, ARCHITECTPATHS.LINKED_SERVICE_MAP_FILENAME);
    if (fs.existsSync(linkedServicesFile)) {
      this.linkedServices = fs.readJSONSync(linkedServicesFile) as LinkedServicesMap;
    }
  }

  private saveLinkedServices() {
    const linkedServicesFile = path.join(this.config.getConfigDir(), ARCHITECTPATHS.LINKED_SERVICE_MAP_FILENAME);
    fs.writeJSONSync(linkedServicesFile, this.linkedServices);
  }

  linkServicePath(serviceName: string, servicePath: string) {
    this.linkedServices[serviceName] = servicePath;
    this.saveLinkedServices();
  }

  unlinkService(serviceNameOrPath: string): string | undefined {
    let res;

    if (this.linkedServices.hasOwnProperty(serviceNameOrPath)) {
      delete this.linkedServices[serviceNameOrPath];
      res = serviceNameOrPath;
    } else {
      this.linkedServices = Object.entries(this.linkedServices).reduce((linkedServices, [serviceName, servicePath]) => {
        if (servicePath !== serviceNameOrPath) {
          linkedServices[serviceName] = servicePath;
        } else {
          res = serviceName;
        }

        return linkedServices;
      }, {} as LinkedServicesMap);
    }

    this.saveLinkedServices();
    return res;
  }

  unlinkAllServices() {
    this.linkedServices = {};
    this.saveLinkedServices();
  }

  saveConfig() {
    this.config.save();
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
          if (err?.response?.status === 401) {
            // Don't repeat the 401 check on a loop
            this._api.interceptors.response.eject(unauthorized_interceptor);

            // Attempt a token refresh
            const new_token = await this.auth.refreshToken().catch(() => undefined);
            if (!new_token) {
              // eslint-disable-next-line no-undef
              return Promise.reject(new LoginRequiredError());
            }

            // Retry the last request with the new token
            this._api.defaults.headers = {
              Authorization: `${new_token.token_type} ${new_token.access_token}`,
            };
            const error_config = err.config;
            error_config.headers.Authorization = this._api.defaults.headers.Authorization;
            return this._api.request(error_config);
          }

          throw err;
        }
      );
    }

    return this._api;
  }
}
