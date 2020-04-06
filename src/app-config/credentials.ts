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
  private keytar: any;
  private keychainWarningIssued = false;

  constructor(config: AppConfig) {
    this.credentials_file = path.join(config.getConfigDir(), CREDENTIALS_FILENAME);
    fs.ensureFileSync(this.credentials_file);
    this.credentials = fs.readJSONSync(this.credentials_file, { throws: false }) || {};
  }

  private save() {
    return fs.writeJSON(this.credentials_file, this.credentials, { replacer: null, spaces: 2 });
  }

  async init() {
    try {
      // eslint-disable-next-line no-undef
      this.keytar = require('keytar');
      await this.keytar.setPassword('architect', 'test', 'value');
      await this.keytar.deletePassword('architect', 'test');
    } catch {
      // eslint-disable-next-line no-undef
      if (!this.keychainWarningIssued) {
        console.warn(`No system keychain found. Storing credentials in ${this.credentials_file}.`);
        this.keychainWarningIssued = true;
      }

      this.keytar = null;
    }
  }

  async get(service: string): Promise<Credential> {
    if (this.keytar) {
      const credentials = await this.keytar.findCredentials(service);
      return credentials.length ? credentials[0] : null;
    } else {
      return this.credentials[service];
    }
  }

  async set(service: string, account: string, password: string) {
    if (this.keytar) {
      await this.keytar.setPassword(service, account, password);
    } else {
      this.credentials[service] = { account, password };
      await this.save();
    }
  }

  async delete(service: string) {
    if (this.keytar) {
      for (const credential of await this.keytar.findCredentials(service)) {
        await this.keytar.deletePassword(service, credential.account);
      }
    } else {
      delete this.credentials[service];
      await this.save();
    }
  }
}
