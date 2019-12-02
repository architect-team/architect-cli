import {flags} from '@oclif/command';
import Command from '../../base-command';
import untildify from 'untildify';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import chalk from 'chalk';
import { EnvironmentNameValidator } from '../../common/utils/validation';
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
    name: 'name',
    description: 'Name of the environment to update',
    parse: (value: string) => value.toLowerCase(),
  }];

  async run() {
    const {args, flags} = this.parse(EnvironmentUpdate)

    let answers: any = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        when: !args.name,
        filter: value => value.toLowerCase(),
        validate: value => {
          if (EnvironmentNameValidator.test(value)) return true;
          return `Name must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character`;
        },
      }
    ]);
    answers = { ...args, ...flags, ...answers };

    await this.app.api.put(`/environments/${answers.name}`, {
      host: answers.host,
      service_token: await readIfFile(answers.service_token),
      cluster_ca_certificate: await readIfFile(answers.cluster_ca_certificate),
      config: answers.config_file ? await fs.readJSON(untildify((answers.config_file))) : undefined,
    });

    this.log(chalk.green('Environment updated successfully'));
  }
}
