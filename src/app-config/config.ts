import fs from 'fs-extra';
import path from 'path';
import ARCHITECTPATHS from '../paths';

export default class AppConfig {
  private config_dir: string;
  log_level: 'info' | 'debug' | 'test';
  registry_host: string;
  api_host: string;
  oauth_domain: string;
  oauth_client_id: string;

  constructor(config_dir: string, partial?: Partial<AppConfig>) {
    this.config_dir = config_dir;

    // Set defaults
    this.log_level = 'info';
    this.registry_host = 'registry.architect.io';
    this.api_host = 'https://api.architect.io';
    this.oauth_domain = 'architect.auth0.com';
    this.oauth_client_id = '079Kw3UOB5d2P6yZlyczP9jMNNq8ixds';

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
      oauth_domain: this.oauth_domain,
      oauth_client_id: this.oauth_client_id,
    };
  }
}
