import { Flags } from '@oclif/core';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import tmp from 'tmp';
import untildify from 'untildify';
import { Dictionary } from '../..';
import AccountUtils from '../../architect/account/account.utils';
import { EnvironmentUtils } from '../../architect/environment/environment.utils';
import Command from '../../base-command';
import { SecretsDict } from '../../dependency-manager/secrets/type';

tmp.setGracefulCleanup();

interface Secret {
  scope: string;
  key: string;
  value: string;
}

export default class SecretsUpload extends Command {
  async auth_required(): Promise<boolean> {
    return true;
  }

  static description = 'Upload secrets from a file to an account or an environment';
  static aliases = ['secrets:set'];

  static flags = {
    ...Command.flags,
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,
    override: Flags.boolean({
      description: 'Allow override of existing secrets',
      default: false,
    }),
  };

  static args = [{
    name: 'secrets_file',
    description: 'Secrets file to be uploaded',
    required: true,
  }];

  async run(): Promise<void> {
    const { flags, args } = await this.parse(SecretsUpload);
    const account = await AccountUtils.getAccount(this.app, flags.account);

    const { data: user } = await this.app.api.get('/users/me');
    const membership = user.memberships?.find((membership: any) => membership.account.id === account.id);
    const is_admin = !!membership && membership.role !== 'MEMBER';
    if (!is_admin) {
      this.error('You do not have permission to upload secrets. Please contact your admin.');
    }

    // existing secrets
    let existing_secrets = [];
    let environment;
    if (!flags.environment) {
      existing_secrets = (await this.app.api.get(`accounts/${account.id}/secrets/values`)).data;
    } else {
      environment = await EnvironmentUtils.getEnvironment(this.app.api, account, flags.environment);
      existing_secrets = (await this.app.api.get(`environments/${environment.id}/secrets/values`)).data;
    }

    // loaded secrets
    const secrets_file = path.resolve(untildify(args.secrets_file));
    const secrets_file_data = fs.readFileSync(secrets_file);
    const loaded_secret_yml = yaml.load(secrets_file_data.toString('utf-8')) as Dictionary<Dictionary<string>>;
    if (!loaded_secret_yml) {
      this.log(`There are no secrets found in ${secrets_file}.`);
      return;
    }

    const existing_secret_yml: SecretsDict = {};
    for (const secret of existing_secrets) {
      existing_secret_yml[secret.scope] = existing_secret_yml[secret.scope] || {};
      existing_secret_yml[secret.scope][secret.key] = secret.value;
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

    if (environment) {
      await this.app.api.post(`/environments/${environment.id}/secrets/batch`, update_secrets);
    } else {
      await this.app.api.post(`/accounts/${account.id}/secrets/batch`, update_secrets);
    }

    this.log(`Successfully uploaded secrets from ${secrets_file}`);
  }
}
