import fs from 'fs-extra';
import path from 'path';
import untildify from 'untildify';
import { VaultMetadata } from './environment-metadata';
import { getVaultParameter } from './vault-utils';

export const readIfFile = async (param_value: Object, vaults?: { [key: string]: VaultMetadata }): Promise<string> => {
  if (typeof param_value === 'string') {
    if (param_value && param_value.startsWith('file:')) {
      const res = await fs.readFile(path.resolve(untildify(param_value.slice('file:'.length))), 'utf-8');
      return res.trim();
    } else {
      return param_value;
    }
  } else {
    if (!vaults) {
      throw new Error('Please specify a vault in your environment config');
    }
    console.log(await getVaultParameter(param_value, vaults))
    return 'TEST_DATA' // TODO: replace with vault data
  }
};
