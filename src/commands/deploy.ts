import { flags } from '@oclif/command';
import inquirer = require('inquirer');
import * as Listr from 'listr';

import Command from '../base';

export default class Deploy extends Command {
  static description = 'Deploy service to environments';

  static args = [
    { name: 'service', description: 'Service name' }
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
    environment: flags.string({ char: 'e' }),
  };

  async run() {
    const answers = await this.promptOptions();

    let plan: any;
    const tasks = new Listr([
      {
        title: `Planning`,
        task: async () => {
          const params = {
            environment: answers.environment,
            service_version: answers.service_version,
          };
          const { data } = await this.architect.post(`/repositories/${answers.service_name}/plan`, { params });
          plan = data;
        }
      }
    ]);
    await tasks.run();
    this.log(plan.info);

    const confirmation = await inquirer.prompt({
      type: 'confirm',
      name: 'apply',
      message: 'Would you like to apply this plan?'
    } as inquirer.Question);

    if (confirmation.apply) {
      const tasks = new Listr([
        {
          title: `Deploying`,
          task: async () => {
            const params = { timestamp: plan.timestamp };
            await this.architect.post(`/environments/${answers.environment}/deploy`, { params });
          }
        }
      ]);
      await tasks.run();
    } else {
      this.warn('Canceled deploy');
    }
  }

  async promptOptions() {
    const { args, flags } = this.parse(Deploy);

    const [service_name, service_version] = args.service ? args.service.split(':') : [undefined, undefined];
    let options = {
      service_name,
      service_version,
      environment: flags.environment
    };

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
      when: !service_name
    } as inquirer.Question, {
      type: 'list',
      name: 'service_version',
      message: 'Select version:',
      choices: async (answers_so_far: any) => {
        const { data: service } = await this.architect.get(`/repositories/${answers_so_far.service_name || service_name}`);
        return service.tags;
      },
      when: !service_version
    }, {
      type: 'autocomplete',
      name: 'environment',
      message: 'Select environment:',
      source: async (_: any, input: string) => {
        const params = { q: input };
        const { data: environments } = await this.architect.get('/environments', { params });
        return environments.map((environment: any) => environment.name);
      },
      when: !flags.environment
    } as inquirer.Question]);

    return { ...options, ...answers };
  }
}
