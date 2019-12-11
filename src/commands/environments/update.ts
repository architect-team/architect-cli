import { flags } from '@oclif/command';
import chalk from 'chalk';
import { cli } from 'cli-ux';
import fs from 'fs-extra';
import untildify from 'untildify';
import Command from '../../base-command';
import { readIfFile } from '../../common/utils/file';

export default class EnvironmentUpdate extends Command {
  static aliases = ['environment:update', 'envs:update', 'env:update'];
  static description = 'Update an environments configuration';

  static flags = {
    ...Command.flags,
    host: flags.string(),
    service_token: flags.string({
      description: 'Service token',
      env: 'ARCHITECT_SERVICE_TOKEN',
      char: 't',
    }),
    cluster_ca_certificate: flags.string({
      description: 'File path of cluster_ca_certificate',
      env: 'ARCHITECT_CLUSTER_CA_CERTIFICATE',
      char: 'k',
    }),
    config_file: flags.string({
      description: 'Path to an environment configuration file to use',
      char: 'c',
    }),
  };

  static args = [{
    name: 'namespaced_environment',
    description: 'Name of the environment to update',
    required: true,
    parse: (value: string) => value.toLowerCase(),
  }];

  async run() {
    const { args, flags } = this.parse(EnvironmentUpdate)

    const [account_name, env_name] = args.namespaced_environment.split('/');
    let account;
    try {
      account = (await this.app.api.get(`/accounts/${account_name}`)).data;
    } catch (err) {
      throw new Error(`The account ${account_name} does not exist.`);
    }

    cli.action.start(chalk.green('Updating environment'));
    const { data: account_environment } = await this.app.api.get(`/accounts/${account.id}/environments/${env_name}`);
    const answers = { ...args, ...flags };
    await this.app.api.put(`/environments/${account_environment.id}`, {
      host: answers.host,
      service_token: await readIfFile(answers.service_token),
      cluster_ca_certificate: await readIfFile(answers.cluster_ca_certificate),
      config: answers.config_file ? await fs.readJSON(untildify((answers.config_file))) : undefined,
    });
    cli.action.stop(chalk.green('Environment updated successfully'));
  }
}
