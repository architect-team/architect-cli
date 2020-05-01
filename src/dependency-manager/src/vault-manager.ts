import axios from 'axios';
import https from 'https';
import { EnvironmentVault } from './environment-config/base';
import { ValueFromParameter, VaultParameter } from './service-config/base';

export default class VaultManager {
  protected vaults: { [key: string]: EnvironmentVault };
  protected client_token_cache: { [key: string]: string };
  protected secret_cache: { [key: string]: any };

  constructor(vaults: { [key: string]: EnvironmentVault }) {
    this.vaults = vaults;
    this.client_token_cache = {};
    this.secret_cache = {};
    for (const vault_name of Object.keys(vaults)) {
      this.secret_cache[vault_name] = {};
    }
  }

  public async getSecret(parameter: ValueFromParameter<VaultParameter>): Promise<string> {
    const vault_name = parameter.valueFrom.vault;
    const key = parameter.valueFrom.key;
    const vault = this.vaults[vault_name];

    const vault_client = axios.create({
      baseURL: vault.host,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });

    let client_token;
    if (this.client_token_cache[vault_name]) {
      client_token = this.client_token_cache[vault_name];
    } else if (vault.client_token) {
      client_token = vault.client_token;
    } else if (vault.role_id && vault.secret_id) {
      const { data } = await vault_client.post('/v1/auth/approle/login', { role_id: vault.role_id, secret_id: vault.secret_id });
      client_token = data.auth.client_token;
    } else {
      throw new Error('Unsupported vault authentication method. Please use approle auth.');
    }

    this.client_token_cache[vault_name] = client_token;

    const [secret_engine, secret] = key.split('/');
    const [secret_name, secret_key] = secret.split('#');
    try {
      if (!this.secret_cache[vault_name][`${secret_engine}/${secret}`]) {
        const { data } = await vault_client.get(`/v1/${secret_engine}/data/${secret_name}`, { headers: { 'X-Vault-Token': client_token } });
        this.secret_cache[vault_name][`${secret_engine}/${secret}`] = data.data.data;
      }
      const secret_data = this.secret_cache[vault_name][`${secret_engine}/${secret}`];
      return secret_key ? secret_data[secret_key] : JSON.stringify(secret_data);
    } catch (err) {
      throw new Error(`Error retrieving secret ${key}\n${err}`);
    }
  }
}
