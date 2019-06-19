import { flags } from '@oclif/command';
import inquirer = require('inquirer');

import Command from '../../base';

export default class Services extends Command {
  static description = 'Search services';
  static aliases = ['services:list', 'services:versions'];

  static args = [
    { name: 'service_name', description: 'Service name', required: false }
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
  };

  async run() {
    const { args } = this.parse(Services);
    inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

    const answers = await inquirer.prompt([{
      type: 'autocomplete',
      name: 'service_name',
      message: 'Select service:',
      source: async (_: any, input: string) => {
        const params = { q: input };
        const { data: services } = await this.architect.get('/repositories', { params });
        return services.map((service: any) => service.name);
      },
      when: !args.service_name
    } as inquirer.Question]);

    const service_name = { ...args, ...answers }.service_name;
    const { data: service } = await this.architect.get(`/repositories/${service_name}`);
    this.styled_json(service);
  }
}
