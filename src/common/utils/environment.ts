import { flags } from '@oclif/command';
import { AxiosInstance } from 'axios';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { Account } from './account';

export interface Environment {
  id: string;
  name: string;
  platform: {
    type: string;
  };
}

export class EnvironmentUtils {
  static flags = {
    environment: flags.string({
      description: 'Architect Environment',
      char: 'e',
      env: 'ARCHITECT_ENVIRONMENT',
    }),
  };

  static async getEnvironment(api: AxiosInstance, account: Account, environment_name?: string): Promise<Environment> {
    if (process.env.ARCHITECT_ENVIRONMENT === environment_name) {
      console.log(chalk.blue(`Using environment context: `) + environment_name);
    }

    let environment: Environment;
    if (environment_name) {
      environment = (await api.get(`/accounts/${account.id}/environments/${environment_name}`)).data;
    } else {
      inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

      // inquirer-autocomplete-prompt doesn't catch exceptions in source...
      const { data } = await api.get(`/accounts/${account.id}/environments`, { params: { limit: 1 } });
      if (!data.total) {
        throw new Error(`No configured environments. Run 'architect environment:create -a ${account.name}'.`);
      }

      let environments: Environment[] = [];
      const answers: any = await inquirer.prompt([
        {
          type: 'autocomplete',
          name: 'environment',
          message: 'Select a environment',
          filter: (x) => x, // api filters
          source: async (answers_so_far: any, input: string) => {
            const { data } = await api.get(`/accounts/${account.id}/environments`, { params: { q: input, limit: 10 } });
            environments = data.rows;
            return environments;
          },
        },
      ]);

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      environment = environments.find((environment) => environment.name === answers.environment)!;
    }
    return environment;
  }
}
