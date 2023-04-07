import fs from 'fs-extra';
import path from 'path';
import AppConfig from './config';

const CREDENTIALS_FILENAME = 'creds.json';

export interface Credential {
  account: string;
  password: string;
}

export default class CredentialManager {
  private credentials_file: string;
  private credentials: { [key: string]: Credential };

  constructor(config: AppConfig) {
    this.credentials_file = path.join(config.getConfigDir(), CREDENTIALS_FILENAME);
    fs.ensureFileSync(this.credentials_file);
    this.credentials = fs.readJSONSync(this.credentials_file, { throws: false }) || {};
  }

  private save() {
    return fs.writeJSON(this.credentials_file, this.credentials, { replacer: undefined, spaces: 2 });
  }

  async get(service: string): Promise<Credential | undefined> {
    return this.credentials[service];
  }

  async set(service: string, account: string, password: string): Promise<void> {
    this.credentials[service] = { account, password };
    await this.save();
  }

  async delete(service: string): Promise<void> {
    delete this.credentials[service];
    await this.save();
  }
}
