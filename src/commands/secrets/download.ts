import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import tmp from 'tmp';
import untildify from 'untildify';
import { Dictionary } from '../..';
import AccountUtils from '../../architect/account/account.utils';
import { EnvironmentUtils } from '../../architect/environment/environment.utils';
import Command from '../../base-command';

tmp.setGracefulCleanup();

export default class SecretsDownload extends Command {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Download secrets from an account or an environment';
  static aliases = ['secrets', 'secrets/get'];

  static flags = {
    ...Command.flags,
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,
  };

  static args = [{
    name: 'secrets_file',
    description: 'Secrets filename to download secrets',
    default: './secrets.yml',
  }];

  async run(): Promise<void> {
    const { flags, args } = await this.parse(SecretsDownload);
    const secrets_file = path.resolve(untildify(args.secrets_file));
    const account = await AccountUtils.getAccount(this.app, flags.account);

    let secrets = [];
    let environment;
    if (!flags.environment) {
      secrets = (await this.app.api.get(`accounts/${account.id}/secrets/values`)).data;
    } else {
      environment = await EnvironmentUtils.getEnvironment(this.app.api, account, flags.environment);
      secrets = (await this.app.api.get(`environments/${environment.id}/secrets/values`, { params: { inherited: true } })).data;
    }

    const secret_yaml: Dictionary<Dictionary<string>> = {};
    for (const secret of secrets) {
      secret_yaml[secret.scope] = secret_yaml[secret.scope] || {};
      secret_yaml[secret.scope][secret.key] = secret.value;
    }
    await fs.writeFile(secrets_file, yaml.dump(secret_yaml), (err) => {
      if (err) {
        throw new Error('Failed to download secrets!');
      }
    });

    this.log(`Secrets are downloaded to ${secrets_file}`);
  }
}
