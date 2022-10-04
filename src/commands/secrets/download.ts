import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import chalk from 'chalk';
import untildify from 'untildify';
import AccountUtils from '../../architect/account/account.utils';
import { EnvironmentUtils } from '../../architect/environment/environment.utils';
import PlatformUtils from '../../architect/platform/platform.utils';
import SecretUtils from '../../architect/secret/secret.utils';
import UserUtils from '../../architect/user/user.utils';
import BaseCommand from '../../base-command';
import { SecretsDict } from '../../dependency-manager/secrets/type';

export default class SecretsDownload extends BaseCommand {
  static description = 'Download secrets from an account or an environment';
  static aliases = ['secrets', 'secrets/get'];
  static examples = [
    'architect secrets --account=myaccount ./mysecrets.yml',
    'architect secrets --account=myaccount --platform=myplatform ./mysecrets.yml',
    'architect secrets --account=myaccount --environment=myenvironment ./mysecrets.yml',
  ];
  static flags = {
    ...BaseCommand.flags,
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,
    ...PlatformUtils.flags,
  };

  static args = [{
    sensitive: false,
    name: 'secrets_file',
    description: 'Secrets filename to download secrets',
    required: true,
  }];

  async run(): Promise<void> {
    const { flags, args } = await this.parse(SecretsDownload);

    if (!flags.account) {
      this.log(chalk.red('Account is not found. Please see examples below:'));
      this.log(`  ${SecretsDownload.examples.join('\n  ')}`);
      return;
    }

    if (flags.platform && flags.environment) {
      throw new Error('Please provide either the platform flag or the environment flag and not both.');
    }
    
    const account = await AccountUtils.getAccount(this.app, flags.account);
    const is_admin = await UserUtils.isAdmin(this.app, account.id);
    if (!is_admin) {
      this.error('You do not have permission to download secrets. Please contact your admin.');
    }

    const secrets = await SecretUtils.getSecrets(this.app, account, flags.platform, flags.environment, true);
    if (secrets.length === 0) {
      this.log('There are no secrets to download.');
      return;
    }

    const secret_yml: SecretsDict = {};
    for (const secret of secrets) {
      secret_yml[secret.scope] = secret_yml[secret.scope] || {};
      secret_yml[secret.scope][secret.key] = secret.value;
    }

    const secrets_file = path.resolve(untildify(args.secrets_file));
    fs.writeFileSync(secrets_file, yaml.dump(secret_yml));

    this.log(`Secrets have been downloaded to ${secrets_file}`);
  }
}
