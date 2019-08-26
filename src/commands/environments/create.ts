import { flags } from '@oclif/command';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import Listr from 'listr';
import untildify from 'untildify';
import Command from '../../base';
import { readIfFile } from '../../common/file-util';
import { EnvironmentNameValidator } from '../../common/validation-utils';

export default class CreateEnvironment extends Command {
  static description = 'Create environment';
  static aliases = ['environment:create'];

  static args = [
    { name: 'name', description: 'Environment name', parse: (value: string) => value.toLowerCase() }
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
    namespace: flags.string(),
    type: flags.string({ options: ['kubernetes'], default: 'kubernetes' }),
    host: flags.string(),
    service_token: flags.string({ description: 'Service token', env: 'ARCHITECT_SERVICE_TOKEN' }),
    cluster_ca_certificate: flags.string({ description: 'File path of cluster_ca_certificate', env: 'ARCHITECT_CLUSTER_CA_CERTIFICATE' }),
    config_file: flags.string()
  };

  async run() {
    const answers = await this.promptOptions();
    const data = {
      name: answers.name,
      namespace: answers.namespace,
      host: answers.host,
      type: answers.type,
      service_token: await readIfFile(answers.service_token),
      cluster_ca_certificate: await readIfFile(answers.cluster_ca_certificate),
      config: answers.config ? await fs.readJSON(untildify((answers.config))) : undefined
    };

    const tasks = new Listr([
      {
        title: 'Creating Environment',
        task: async context => {
          const { data: environment } = await this.architect.post('/environments', { data });
          context.environment = environment;
        }
      }
    ]);

    await tasks.run();
  }

  async promptOptions() {
    const { args, flags } = this.parse(CreateEnvironment);

    const answers: any = await inquirer.prompt([{
      type: 'input',
      name: 'name',
      when: !args.name,
      filter: value => value.toLowerCase(),
      validate: value => {
        if (EnvironmentNameValidator.test(value)) return true;
        return `Name must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character`;
      }
    }, {
      type: 'input',
      name: 'namespace',
      when: !flags.namespace,
      filter: value => value.toLowerCase(),
      validate: value => {
        if (EnvironmentNameValidator.test(value)) return true;
        return `Namespace must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character`;
      },
      default: (answers: any) => answers.name
    }, {
      type: 'input',
      name: 'host',
      when: !flags.host
    }, {
      type: 'input',
      name: 'service_token',
      message: 'service token:',
      when: !flags.service_token,
    }, {
      type: 'input',
      name: 'cluster_ca_certificate',
      message: 'cluster certificate:',
      when: !flags.cluster_ca_certificate,
    }]);
    return { ...args, ...flags, ...answers };
  }
}
