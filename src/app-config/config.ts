export default class AppConfig {
  log_level: 'info' | 'debug';
  registry_host: string;
  api_host: string;
  oauth_domain: string;
  oauth_client_id: string;
  [key: string]: string;

  constructor(partial?: Partial<AppConfig>) {
    // Set defaults
    this.log_level        = 'info';
    this.registry_host    = 'registry.architect.io';
    this.api_host         = 'https://api.architect.io';
    this.oauth_domain     = 'architect.auth0.com';
    this.oauth_client_id  = '079Kw3UOB5d2P6yZlyczP9jMNNq8ixds';

    // Override defaults with input values
    Object.assign(this, partial);
  }
}
