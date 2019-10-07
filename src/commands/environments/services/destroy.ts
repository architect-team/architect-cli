import { flags } from '@oclif/command';
import chalk from 'chalk';
import inquirer from 'inquirer';
import Listr from 'listr';
import Command from '../../../base';

const _info = chalk.blue;

export default class DestroyService extends Command {
  static description = 'Destroy service from an environment';
  static aliases = ['environment:services:destroy'];

  static args = [
    { name: 'environment', description: 'Environment name', required: false },
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
    service: flags.string({ char: 's', description: 'Service name' }),
    auto_approve: flags.boolean(),
    deployment_id: flags.string({ char: 'p' }),
  };

  async run() {
    const answers = await this.promptOptions();

    if (answers.deployment_id) {
      await this.poll(answers.deployment_id, 'pending');
      await this.deploy(answers.deployment_id);
    } else {
      let deployment: any;
      const tasks = new Listr([
        {
          title: `Planning deletion of service ${_info(answers.service)} from environment ${_info(answers.environment)}`,
          task: async () => {
            const { data: res } = await this.architect.delete(`environments/${answers.environment}/services/${encodeURIComponent(answers.service)}`);
            deployment = res;
            await this.poll(deployment.id, 'pending');
          },
        },
      ]);

      await tasks.run();
      this.log('Deployment Id:', deployment.id);

      const confirmation = await inquirer.prompt({
        type: 'confirm',
        name: 'deploy',
        message: 'Would you like to apply this deployment?',
        when: !answers.auto_approve,
      } as inquirer.Question);

      if (confirmation.deploy || answers.auto_approve) {
        await this.deploy(deployment.id);
      } else {
        this.warn('Canceled deploy');
      }
    }
  }

  async poll(deployment_id: string, match_status: string) {
    return new Promise((resolve, reject) => {
      let poll_count = 0;
      const poll = setInterval(async () => {
        const { data: deployment } = await this.architect.get(`/deploy/${deployment_id}`);
        if (deployment.status.includes('failed') || poll_count > 100) {
          clearInterval(poll);
          reject(new Error('Deployment failed'));
        }
        if (deployment.status === match_status) {
          clearInterval(poll);
          resolve(deployment);
        }
        poll_count += 1;
      }, 3000);
    });
  }

  async deploy(deployment_id: string) {
    const tasks = new Listr([
      {
        title: `Deploying`,
        task: async () => {
          await this.architect.post(`/deploy/${deployment_id}`);
          await this.poll(deployment_id, 'applied');
        },
      },
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
      when: !args.environment,
    } as inquirer.Question, {
      type: 'autocomplete',
      name: 'service',
      message: 'Select service:',
      source: async (answers: any, input: string) => {
        const environment = args.environment || answers.environment;
        const params = { q: input };
        const { data: services } = await this.architect.get(`/environments/${environment}/services`, { params });
        return services.map((service: any) => `${service.name}:${service.tag}`);
      },
      when: !flags.service,
    } as inquirer.Question, {
      type: 'input',
      name: 'destroy',
      message: 'Are you absolutely sure?\nThis will destroy the service from the environment.\nPlease type in the name of the service to confirm.\n',
      validate: (value, answers) => {
        const service = flags.service || answers!.service;
        if (value === service) {
          return true;
        }
        return `Name must match: ${_info(service)}`;
      },
      when: !flags.auto_approve,
    }]);
    return { ...args, ...flags, ...answers };
  }
}
