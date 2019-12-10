import { flags } from '@oclif/command';
import chalk from 'chalk';
import { cli } from 'cli-ux';
import fs from 'fs-extra';
import inquirer from 'inquirer';
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
    name: 'environment',
    description: 'Name of the environment to update',
    required: true,
    parse: (value: string) => value.toLowerCase(),
  }, {
    name: 'account_name',
    description: 'Account that the environment belongs to',
    required: false
  }];

  async run() {
    const { args, flags } = this.parse(EnvironmentUpdate)

    let fetched_account: any;
    let answers: any = await inquirer.prompt([{
      type: 'input',
      name: 'account_name',
      message: 'What account does the environment belong to?',
      when: !args.account_name,
      validate: async (value: any, answers: any) => {
        if (!value) {
          return 'You must select an account';
        }
        try {
          fetched_account = (await this.app.api.get(`/accounts/${value}`)).data;
          if (fetched_account) {
            return true;
          }
        } catch (err) {
          return `You do not have access to the account: ${chalk.blue(value)}`;
        }
      },
    }]);

    if (!fetched_account) {
      const selected_account_name = answers.account_name || args.account_name;
      try {
        fetched_account = (await this.app.api.get(`/accounts/${selected_account_name}`)).data;
      } catch (err) {
        throw new Error(`You do not have access to the account ${selected_account_name}`);
      }
    }

    cli.action.start(chalk.green('Updating environment'));
    answers = { ...args, ...flags, ...answers };
    const { data: account_environment } = await this.app.api.get(`/accounts/${fetched_account.id}/environments/${answers.environment}`);
    await this.app.api.put(`/environments/${account_environment.id}`, {
      host: answers.host,
      service_token: await readIfFile(answers.service_token),
      cluster_ca_certificate: await readIfFile(answers.cluster_ca_certificate),
      config: answers.config_file ? await fs.readJSON(untildify((answers.config_file))) : undefined,
    });
    cli.action.stop(chalk.green('Environment updated successfully'));
  }
}
