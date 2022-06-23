import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import tmp from 'tmp';
import untildify from 'untildify';
import AccountUtils from '../../architect/account/account.utils';
import { EnvironmentUtils } from '../../architect/environment/environment.utils';
import Command from '../../base-command';
import { SecretsDict } from '../../dependency-manager/secrets/type';

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

    const account = await AccountUtils.getAccount(this.app, flags.account);
    const { data: user } = await this.app.api.get('/users/me');
    const membership = user.memberships?.find((membership: any) => membership.account.id === account.id);
    const is_admin = !!membership && membership.role !== 'MEMBER';
    if (!is_admin) {
      this.error('You do not have permission to download secrets. Please contact your admin.');
    }

    let secrets = [];
    let environment;
    if (!flags.environment) {
      secrets = (await this.app.api.get(`accounts/${account.id}/secrets/values`)).data;
    } else {
      environment = await EnvironmentUtils.getEnvironment(this.app.api, account, flags.environment);
      secrets = (await this.app.api.get(`environments/${environment.id}/secrets/values`, { params: { inherited: true } })).data;
    }

    if (secrets.length === 0) {
      this.error('There are no secrets to be downloaded.');
    }

    const secret_yml: SecretsDict = {};
    for (const secret of secrets) {
      secret_yml[secret.scope] = secret_yml[secret.scope] || {};
      secret_yml[secret.scope][secret.key] = secret.value;
    }

    const secrets_file = path.resolve(untildify(args.secrets_file));
    await fs.writeFile(secrets_file, yaml.dump(secret_yml), (err) => {
      if (err) {
        this.error('Failed to download secrets!');
      }
    });

    this.log(JSON.stringify(secret_yml, null, 4));
  }
}
