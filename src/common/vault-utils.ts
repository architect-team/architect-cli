import axios from 'axios';
import * as https from 'https';
import { VaultMetadata } from './environment-metadata';

export const readVaultParam = async (param_value: any, vaults: { [key: string]: VaultMetadata }): Promise<string> => {
  const vault = vaults[param_value.valueFrom.vault];
  const vault_client = axios.create({
    baseURL: vault.host,
    headers: {
      'X-Vault-Token': vault.access_token,
    },
    httpsAgent: new https.Agent({
      rejectUnauthorized: false
    })
  });

  const param_start = param_value.valueFrom.key.lastIndexOf('/');
  const key = param_value.valueFrom.key.substr(0, param_start);
  const param_name = param_value.valueFrom.key.substr(param_start + 1);
  try {
    const res = await vault_client.get(`v1/${key}/data/${param_name}`);
    return res.data.data.data[param_name];
  } catch (err) {
    throw new Error(`Error retrieving secret ${param_value.valueFrom.key}\n${err}`);
  }
}
