import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { CREDENTIAL_PREFIX } from '../app-config/auth';
import AppConfig from '../app-config/config';
import CredentialManager from '../app-config/credentials';
import ARCHITECTPATHS from '../paths';

export default async (options: any) => {
  if (options.Command.id !== 'login') {
    const config_dir = options.config.configDir;
    let config: AppConfig = new AppConfig(config_dir);
    if (config_dir) {
      const config_file = path.join(config_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
      if (fs.existsSync(config_file)) {
        const payload = fs.readJSONSync(config_file);
        config = new AppConfig(config_dir, payload);
      }
    }

    const credentials = new CredentialManager(config);
    const credential = await credentials.get(CREDENTIAL_PREFIX);
    if (!credential) {
      console.error(chalk.red(`Please log in using 'architect login'`))
      process.exit(1);
    }
  }
}
