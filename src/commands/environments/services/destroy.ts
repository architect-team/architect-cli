import { flags } from '@oclif/command';
import chalk from 'chalk';
import inquirer from 'inquirer';
import Listr from 'listr';

import Command from '../../../base';

const _info = chalk.blue;

export default class DestroyService extends Command {
  static description = 'Destroy service from an environment';
  static aliases = ['envs:services:destroy'];

  static args = [
    { name: 'service', description: 'Service name', required: false }
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
    environment: flags.string({ description: 'Environment name' }),
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
          title: `Deleting service ${_info(answers.service)} from environment ${_info(answers.environment)}`,
          task: async () => {
            const params = { service: answers.service };
            const { data } = await this.architect.delete(`/environments/${answers.environment}/services`, { params });
            plan = data;
          }
        },
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
    const { args, flags } = this.parse(DestroyService);

    inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

    const answers: any = await inquirer.prompt([{
      type: 'autocomplete',
      name: 'environment',
      message: 'Select environment:',
      source: async (_: any, input: string) => {
        const params = { q: input };
        const { data: environments } = await this.architect.get('/environments', { params });
        return environments.map((environment: any) => environment.name);
      },
      when: !flags.environment
    } as inquirer.Question, {
      type: 'autocomplete',
      name: 'service',
      message: 'Select service:',
      source: async (answers: any, input: string) => {
        const environment = flags.environment || answers.environment;
        const params = { q: input };
        const { data: services } = await this.architect.get(`/environments/${environment}/services`, { params });
        return services;
      },
      when: !args.service
    } as inquirer.Question, {
      type: 'input',
      name: 'destroy',
      message: 'Are you absolutely sure?\nThis will destroy the service from the environment.\nPlease type in the name of the service to confirm.\n',
      validate: (value, answers) => {
        const service = args.service || answers!.service;
        if (value === service) {
          return true;
        }
        return `Name must match: ${_info(service)}`;
      }
    }]);
    return { ...args, ...flags, ...answers };
  }
}
