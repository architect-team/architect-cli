import { Flags } from '@oclif/core';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import untildify from 'untildify';
import { Dictionary } from '../..';
import AccountUtils from '../../architect/account/account.utils';
import { EnvironmentUtils } from '../../architect/environment/environment.utils';
import SecretUtils, { Secret } from '../../architect/secret/secret.utils';
import UserUtils from '../../architect/user/user.utils';
import BaseCommand from '../../base-command';
import { SecretsDict } from '../../dependency-manager/secrets/type';

export default class SecretsUpload extends BaseCommand {
  static description = 'Upload secrets from a file to an account or an environment';
  static aliases = ['secrets:set'];
  static examples = [
    'architect secrets:set --account=myaccount --environment=myenvironment ./mysecrets.yml',
    'architect secrets:set --account=myaccount --override ./mysecrets.yml',
  ];
  static flags = {
    ...BaseCommand.flags,
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,
    override: Flags.boolean({
      description: 'Allow override of existing secrets',
      default: false,
      sensitive: false,
    }),
  };

  static args = [{
    sensitive: false,
    name: 'secrets_file',
    description: 'Secrets file to be uploaded',
    required: true,
  }];

  async run(): Promise<void> {
    const { flags, args } = await this.parse(SecretsUpload);
    const account = await AccountUtils.getAccount(this.app, flags.account);

    const is_admin = await UserUtils.isAdmin(this.app, account.id);
    if (!is_admin) {
      this.error('You do not have permission to upload secrets. Please contact your admin.');
    }

    // loaded secrets
    const secrets_file = path.resolve(untildify(args.secrets_file));
    const secrets_file_data = fs.readFileSync(secrets_file);
    const loaded_secret_yml = yaml.load(secrets_file_data.toString('utf-8')) as Dictionary<Dictionary<string>>;
    if (!loaded_secret_yml) {
      this.log(`There are no secrets found in ${secrets_file}.`);
      return;
    }

    // existing secrets
    const existing_secrets = await SecretUtils.getSecrets(this.app, account, flags.environment);
    const existing_secret_yml: SecretsDict = {};
    if (existing_secrets && existing_secrets.length > 0) {
      for (const secret of existing_secrets) {
        existing_secret_yml[secret.scope] = existing_secret_yml[secret.scope] || {};
        existing_secret_yml[secret.scope][secret.key] = secret.value;
      }
    }

    // update secrets
    const update_secrets: Secret[] = [];
    for (const [scope, secrets] of Object.entries(loaded_secret_yml)) {
      for (const [key, value] of Object.entries(secrets)) {
        if (flags.override || !existing_secret_yml || !existing_secret_yml[scope] || !existing_secret_yml[scope][key]) {
          update_secrets.push({ scope, key, value });
        }
      }
    }
    await SecretUtils.batchUpdateSecrets(this.app, update_secrets, account, flags.environment);

    this.log(`Successfully uploaded secrets from ${secrets_file}`);
  }
}
