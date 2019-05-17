import { flags } from '@oclif/command';
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
    const { args, flags } = this.parse(CreateEnvironment);

    const answers: any = await inquirer.prompt([{
      type: 'input',
      name: 'name',
      default: flags.name
    }, {
      type: 'input',
      name: 'host',
      default: flags.host
    }, {
      type: 'input',
      name: 'client_certificate',
      message: 'client certificate (path):',
      default: flags.client_certificate
    }, {
      type: 'input',
      name: 'client_key',
      message: 'client key (path):',
      default: flags.client_key
    }, {
      type: 'input',
      name: 'cluster_ca_certificate',
      message: 'cluster certificate (path):',
      default: flags.cluster_ca_certificate
    }]);

    // TODO upload or read cert files
    throw Error('Not Implemented');

    const data = { ...flags, ...answers };

    const tasks = new Listr([
      {
        title: `${args.id ? 'Updating' : 'Creating'} Environment`,
        task: async context => {
          let res;
          if (args.id) {
            res = this.architect.put(`/environments/${args.id}`, data);
          } else {
            res = this.architect.post('/environments', data);
          }
          const { body: environment } = await res;
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

    tasks.run().catch(err => {
      this.error(err);
    });
  }
}
