import { flags } from '@oclif/command';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import Listr from 'listr';
import untildify from 'untildify';
import Command from '../../base';
import { readIfFile } from '../../common/file-util';
import { EnvironmentNameValidator } from '../../common/validation-utils';

export default class UpdateEnvironment extends Command {
  static description = 'Update environment';
  static aliases = ['environment:update'];

  static args = [
    { name: 'name', description: 'Environment name', parse: (value: string) => value.toLowerCase() }
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
    host: flags.string(),
    service_token: flags.string({ description: 'Service token', env: 'ARCHITECT_SERVICE_TOKEN' }),
    cluster_ca_certificate: flags.string({ description: 'File path of cluster_ca_certificate', env: 'ARCHITECT_CLUSTER_CA_CERTIFICATE' }),
    config_file: flags.string()
  };

  async run() {
    const answers = await this.promptOptions();
    const data = {
      host: answers.host,
      service_token: await readIfFile(answers.service_token),
      cluster_ca_certificate: await readIfFile(answers.cluster_ca_certificate),
      config: answers.config_file ? await fs.readJSON(untildify((answers.config_file))) : undefined
    };

    const tasks = new Listr([
      {
        title: 'Updating Environment',
        task: async context => {
          const { data: environment } = await this.architect.put(`/environments/${answers.name}`, { data });
          context.environment = environment;
        }
      }
    ]);

    await tasks.run();
  }

  async promptOptions() {
    const { args, flags } = this.parse(UpdateEnvironment);

    const answers: any = await inquirer.prompt([{
      type: 'input',
      name: 'name',
      when: !args.name,
      filter: value => value.toLowerCase(),
      validate: value => {
        if (EnvironmentNameValidator.test(value)) return true;
        return `Name must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character`;
      }
    }]);
    return { ...args, ...flags, ...answers };
  }
}
