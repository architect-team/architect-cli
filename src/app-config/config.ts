import fs from 'fs-extra';
import path from 'path';
import ARCHITECTPATHS from '../paths';

export default class AppConfig {
  private config_dir: string;
  log_level: 'info' | 'debug' | 'test';
  registry_host: string;
  api_host: string;
  app_host: string;
  oauth_domain: string;

  constructor(config_dir: string, partial?: Partial<AppConfig>) {
    this.config_dir = config_dir;

    if (partial?.registry_host) {
      partial.registry_host = partial.registry_host.replace('http://', '').replace('https://', '');
    }

    if (partial?.api_host) {
      partial.api_host = partial.api_host.replace('http://', '').replace('https://', '');
      if (partial?.api_host.includes('localhost') || partial?.api_host.includes('0.0.0.0')) {
        partial.api_host = `http://${partial.api_host}`;
      } else {
        partial.api_host = `https://${partial.api_host}`;
      }
    }

    // Set defaults
    this.log_level = 'info';
    this.registry_host = 'registry.architect.io';
    this.api_host = 'https://api.architect.io';
    this.app_host = 'https://app.architect.io';
    this.oauth_domain = 'auth.architect.io';

    // Override defaults with input values
    Object.assign(this, partial);
  }

  getConfigDir() {
    return this.config_dir;
  }

  save() {
    const config_file = path.join(this.config_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(config_file, this);
  }

  toJSON() {
    return {
      log_level: this.log_level,
      registry_host: this.registry_host,
      api_host: this.api_host,
      app_host: this.app_host,
      oauth_domain: this.oauth_domain,
    };
  }
}
