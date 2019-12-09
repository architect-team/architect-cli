import { flags } from '@oclif/command';
import chalk from 'chalk';
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
    parse: (value: string) => value.toLowerCase(),
  }, {
    name: 'account_name',
    description: 'Account that the environment belongs to',
    required: false
  }];

  async run() {
    const { args, flags } = this.parse(EnvironmentUpdate)

    let answers: any = await inquirer.prompt([{
      type: 'input',
      name: 'account_name',
      message: 'What account does the environment belong to?',
      when: !args.account_name,
    }]);

    const { data: fetched_account } = await this.app.api.get(`/accounts/${answers.account_name || args.account_name.split('=')[1]}`);

    inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
    answers = Object.assign({}, answers, await inquirer.prompt([{
      type: 'autocomplete',
      name: 'environment',
      message: 'Select environment:',
      source: async (_: any, input: string) => {
        const params = { q: input };
        const { data: environments } = await this.app.api.get(`/accounts/${fetched_account.id}/environments`, { params });
        return environments.map((environment: any) => environment.name);
      },
      when: !args.environment,
    }]));

    answers = { ...args, ...flags, ...answers };
    const { data: account_environment } = await this.app.api.get(`/accounts/${fetched_account.id}/environments/${answers.environment}`);
    await this.app.api.put(`/environments/${account_environment.id}`, {
      host: answers.host,
      service_token: await readIfFile(answers.service_token),
      cluster_ca_certificate: await readIfFile(answers.cluster_ca_certificate),
      config: answers.config_file ? await fs.readJSON(untildify((answers.config_file))) : undefined,
    });

    this.log(chalk.green('Environment updated successfully'));
  }
}
