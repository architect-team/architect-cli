import { flags } from '@oclif/command';
import * as fs from 'fs';
import * as inquirer from 'inquirer';
import * as Listr from 'listr';

import Command from '../../base';

export default class CreateEnvironment extends Command {
  static description = 'Create or update environment';
  static aliases = ['envs:create'];

  static args = [
    { name: 'name', description: 'Environment name' }
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
    type: flags.string({ options: ['kubernetes'], default: 'kubernetes' }),
    host: flags.string(),
    client_certificate: flags.string({ description: 'File path of client_certificate' }),
    client_key: flags.string({ description: 'File path of client_key' }),
    cluster_ca_certificate: flags.string({ description: 'File path of cluster_ca_certificate' })
  };

  async run() {
    const answers = await this.promptOptions();
    const data = {
      name: answers.name,
      host: answers.host,
      type: answers.type,
      client_certificate: fs.readFileSync(answers.client_certificate, 'utf8'),
      client_key: fs.readFileSync(answers.client_key, 'utf8'),
      cluster_ca_certificate: fs.readFileSync(answers.cluster_ca_certificate, 'utf8')
    };

    const tasks = new Listr([
      {
        title: 'Creating Environment',
        task: async context => {
          const { data: environment } = await this.architect.post('/environments', { data });
          context.environment = environment;
        }
      },
      {
        title: 'Testing Environment',
        task: async context => {
          await this.architect.get(`/environments/${context.environment.id}/test`);
        }
      }
    ]);

    await tasks.run();
  }

  async promptOptions() {
    const { args, flags } = this.parse(CreateEnvironment);

    let answers: any = await inquirer.prompt([{
      type: 'input',
      name: 'name',
      when: !args.name
    }, {
      type: 'input',
      name: 'host',
      when: !flags.host
    }, {
      type: 'input',
      name: 'client_certificate',
      message: 'client certificate (path):',
      when: !flags.client_certificate,
    }, {
      type: 'input',
      name: 'client_key',
      message: 'client key (path):',
      when: !flags.client_key,
    }, {
      type: 'input',
      name: 'cluster_ca_certificate',
      message: 'cluster certificate (path):',
      when: !flags.cluster_ca_certificate,
    }]);
    return { ...args, ...flags, ...answers };
  }
}
