import { flags } from '@oclif/command';
import * as fs from 'fs';
import * as inquirer from 'inquirer';
import * as Listr from 'listr';

import Command from '../../base';

export default class CreateEnvironment extends Command {
  static description = 'Create or update environment';
  static aliases = ['environments:update'];
  static usage = 'environments:create [OPTIONS]\n$ architect environments:update [ID] [OPTIONS]';

  static args = [
    { name: 'id', description: 'Environment Id', required: false }
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
    name: flags.string(),
    host: flags.string(),
    client_certificate: flags.string({ description: 'File path of client_certificate' }),
    client_key: flags.string({ description: 'File path of client_key' }),
    cluster_ca_certificate: flags.string({ description: 'File path of cluster_ca_certificate' })
  };

  async run() {
    const { args } = this.parse(CreateEnvironment);
    const answers = await this.promptOptions();

    const data = {
      name: answers.name,
      host: answers.host,
      client_certificate: fs.readFileSync(answers.client_certificate, 'utf8'),
      client_key: fs.readFileSync(answers.client_key, 'utf8'),
      cluster_ca_certificate: fs.readFileSync(answers.cluster_ca_certificate, 'utf8')
    };

    const tasks = new Listr([
      {
        title: `${args.id ? 'Updating' : 'Creating'} Environment`,
        task: async context => {
          let res;
          if (args.id) {
            res = this.architect.put(`/environments/${args.id}`, { data });
          } else {
            res = this.architect.post('/environments', { data });
          }
          const { data: environment } = await res;
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
    const { flags } = this.parse(CreateEnvironment);

    let answers: any = await inquirer.prompt([{
      type: 'input',
      name: 'name',
      when: !flags.name
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
    return { ...flags, ...answers };
  }
}
