import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import MANAGED_PATHS from './managed-paths';

let keytar: any;
try {
  keytar = require('keytar');
} catch {
  keytar = null;
}
const config_path = path.join(os.homedir(), MANAGED_PATHS.HIDDEN, 'config.json');

const getConfig = async () => {
  await fs.ensureFile(config_path);
  const config = await fs.readJSON(config_path).catch(() => ({}));
  config.auths = config.auths || {};
  return config;
};

const setPassword = async (service: string, account: string, password: string): Promise<void> => {
  if (keytar) {
    keytar.setPassword(service, account, password);
  } else {
    // tslint:disable-next-line: no-console
    console.warn(`Storing password as plain text in ${config_path}`);
    const config = await getConfig();
    config.auths[service] = { account, password };
    await fs.writeJSON(config_path, config, { replacer: null, spaces: 2 });
  }
};

const deletePassword = async (service: string): Promise<void> => {
  if (keytar) {
    for (const credential of await keytar.findCredentials(service)) {
      await keytar.deletePassword(service, credential.account);
    }
  } else {
    const config = await getConfig();
    delete config.auths[service];
    await fs.writeJSON(config_path, config, { replacer: null, spaces: 2 });
  }
};

const findCredential = async (service: string): Promise<{ account: string, password: string }> => {
  if (keytar) {
    const credentials = await keytar.findCredentials(service);
    return credentials.length ? credentials[0] : null;
  } else {
    const config = await getConfig();
    return config.auths[service];
  }
};

export default { setPassword, deletePassword, findCredential };
