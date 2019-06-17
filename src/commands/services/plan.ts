import { flags } from '@oclif/command';
import * as fs from 'fs-extra';
import inquirer = require('inquirer');

import Command from '../../base';

export default class Plan extends Command {
  static description = 'Plan terraform template for service and dependencies';
  static usage = 'services:plan [ID] [OPTIONS]';

  static args = [
    { name: 'service_id', description: 'Service Id' },
    { name: 'service_version', description: 'Service Version' },
    { name: 'environment_id', description: 'Environment Id' }
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
    file: flags.string({ char: 'f' })
  };

  async run() {
    const answers = await this.promptOptions();
    const { data: template } = await this.architect.get(`/repositories/${answers.service_id}/plan/${answers.environment_id}`);
    if (answers.file) {
      await fs.writeFile(answers.file, template);
    } else {
      this.log(template);
    }
  }

  async promptOptions() {
    const { args, flags } = this.parse(Plan);

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
    } as inquirer.Question, {
      type: 'list',
      name: 'service_version',
      message: 'Select version:',
      choices: async (answers_so_far: any) => {
        const { data: service } = await this.architect.get(`/repositories/${answers_so_far.service_id}`);
        return service.tags;
      },
      when: !args.service_version
    }, {
      type: 'autocomplete',
      name: 'environment_id',
      message: 'Select environment:',
      source: async (_: any, input: string) => {
        const params = { q: input };
        const { data: environments } = await this.architect.get('/environments', { params });
        return environments.map((environment: any) => ({ name: environment.name, value: environment.id }));
      },
      when: !args.environment_id
    } as inquirer.Question]);

    return { ...args, ...flags, ...answers };
  }
}
