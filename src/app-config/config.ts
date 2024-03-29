import fs from 'fs-extra';
import path from 'path';
import { Dictionary } from '../';
import LocalPaths from '../paths';

export enum ENVIRONMENT {
  TEST = 'test',
  PRODUCTION = 'production',
  DEV = 'dev',
  LOCAL = 'local',
  PREVIEW = 'preview',
}

export default class AppConfig {
  private config_dir: string;
  log_level: 'info' | 'debug' | 'test';
  registry_host: string;
  api_host: string;
  app_host: string;
  oauth_host: string;
  oauth_client_id: string;
  account: string;
  agent_server_host: string;
  environment: string;
  external_https_address: string;
  external_http_address: string;
  posthog_api_key: string;
  posthog_api_host: string;
  analytics_disabled: boolean;

  constructor(config_dir: string, partial?: Partial<AppConfig>) {
    this.config_dir = config_dir;

    if (partial?.registry_host) {
      partial.registry_host = partial.registry_host.replace('http://', '').replace('https://', '');
    }

    // Set defaults
    this.log_level = 'info';
    this.registry_host = 'registry.architect.io';
    this.api_host = 'https://api.architect.io';
    this.app_host = 'https://cloud.architect.io';
    this.oauth_host = 'https://auth.architect.io';
    this.oauth_client_id = '079Kw3UOB5d2P6yZlyczP9jMNNq8ixds';
    this.account = '';
    this.agent_server_host = 'https://agent-client.architect.io';
    this.environment = process.env.TEST === '1' ? ENVIRONMENT.TEST : ENVIRONMENT.PRODUCTION;
    this.external_https_address = 'localhost.architect.sh';
    this.external_http_address = 'arc.localhost';
    this.posthog_api_key = 'phc_Wb11qMDWr6OX6Y7Y9jVsqDYSVagSLYOA8vluHkML9JV';
    this.posthog_api_host = 'https://ph.architect.io/';
    this.analytics_disabled = process.env.TEST === '1' || process.env.NODE_ENV === 'development';

    // Override defaults with input values
    Object.assign(this, partial);

    // Use new cloud address
    if (this.app_host.includes('app.architect.io')) {
      this.app_host = 'https://cloud.architect.io';
    }
  }

  defaultAccount(): string | null {
    return this.account === '' ? null : this.account;
  }

  getPluginDirectory(): string {
    return path.join(this.config_dir, '/plugins');
  }

  getConfigDir(): string {
    return this.config_dir;
  }

  set<Key extends keyof this>(key: Key, value: this[Key]): void {
    this[key] = value;
  }

  save(): void {
    const config_file = path.join(this.config_dir, LocalPaths.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(config_file, this, { spaces: 2 });
  }

  toJSON(): Dictionary<string | boolean> {
    return {
      log_level: this.log_level,
      registry_host: this.registry_host,
      api_host: this.api_host,
      app_host: this.app_host,
      account: this.account,
      agent_server_host: this.agent_server_host,
      analytics_disabled: this.analytics_disabled,
    };
  }
}
