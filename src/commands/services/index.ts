import { flags } from '@oclif/command';
import inquirer = require('inquirer');

import Command from '../../base';

export default class Services extends Command {
  static description = 'List, create, or delete services';
  static usage = 'services [OPTIONS]\n$ architect services:generate [ID] [OPTIONS]\n$ architect services:plan [ID] [OPTIONS]';
  static aliases = ['services:list'];

  static args = [
    { name: 'service_id', description: 'Service Id', required: false }
  ];

  static flags = {
    help: flags.help({ char: 'h' })
  };

  async run() {
    const { args } = this.parse(Services);
    inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

    const answers = await inquirer.prompt([{
      type: 'autocomplete',
      name: 'service_id',
      message: 'Select service:',
      source: async (_: any, input: string) => {
        const params = { q: input };
        const { data: services } = await this.architect.get('/repositories', { params });
        return services.map((service: any) => ({ name: service.name, value: service.id }));
      },
      when: !args.service_id
    } as inquirer.Question]);

    const service_id = { ...args, ...answers }.service_id;
    const { data: services } = await this.architect.get(`/repositories/${service_id}`);
    this.styled_json(services);
  }
}
