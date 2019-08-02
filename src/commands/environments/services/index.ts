import { flags } from '@oclif/command';
import Command from '../../../base';
import inquirer = require('inquirer');

export default class Services extends Command {
  static description = 'Search an environments services';
  static aliases = [
    'environments:services:list',
    'environments:services:versions',
    'environment:services',
    'environment:services:list',
    'environment:services:versions'
  ];

  static args = [
    { name: 'environment', description: 'Environment name', required: false }
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
  };

  async run() {
    const { args } = this.parse(Services);
    inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

    const answers = await inquirer.prompt([{
      type: 'autocomplete',
      name: 'environment',
      message: 'Select environment:',
      source: async (_: any, input: string) => {
        const params = { q: input };
        const { data: environments } = await this.architect.get('/environments', { params });
        return environments.map((environment: any) => environment.name);
      },
      when: !args.environment
    } as inquirer.Question]);

    const environment_name = { ...args, ...answers }.environment;
    const { data: services } = await this.architect.get(`/environments/${environment_name}/services`);
    this.styled_json(services);
  }
}
