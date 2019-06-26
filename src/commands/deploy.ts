import { flags } from '@oclif/command';
import inquirer = require('inquirer');
import Listr from 'listr';

import Command from '../base';

export default class Deploy extends Command {
  static description = 'Deploy service to environments';

  static args = [
    { name: 'service', description: 'Service name' }
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
    environment: flags.string({ char: 'e' }),
    plan_id: flags.string({ char: 'p' })
  };

  async run() {
    const answers = await this.promptOptions();

    if (answers.plan_id) {
      await this.deploy(answers.environment!, answers.plan_id);
    } else {
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
      this.log(plan.plan_info);
      this.log('Plan Id:', plan.plan_id);

      const confirmation = await inquirer.prompt({
        type: 'confirm',
        name: 'deploy',
        message: 'Would you like to deploy this plan?'
      } as inquirer.Question);

      if (confirmation.deploy) {
        await this.deploy(answers.environment!, plan.plan_id);
      } else {
        this.warn('Canceled deploy');
      }
    }
  }

  async deploy(environment: string, plan_id: string) {
    const tasks = new Listr([
      {
        title: `Deploying`,
        task: async () => {
          const params = { plan_id };
          await this.architect.post(`/environments/${environment}/deploy`, { params });
        }
      }
    ]);
    await tasks.run();
  }

  async promptOptions() {
    const { args, flags } = this.parse(Deploy);

    const [service_name, service_version] = args.service ? args.service.split(':') : [undefined, undefined];
    let options = {
      service_name,
      service_version,
      environment: flags.environment,
      plan_id: flags.plan_id
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
      when: !service_name && !flags.plan_id
    } as inquirer.Question, {
      type: 'list',
      name: 'service_version',
      message: 'Select version:',
      choices: async (answers_so_far: any) => {
        const { data: service } = await this.architect.get(`/repositories/${answers_so_far.service_name || service_name}`);
        return service.tags;
      },
      when: !service_version && !flags.plan_id
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
