import { flags } from '@oclif/command';
import chalk from 'chalk';
import inquirer from 'inquirer';
import AppService from '../../app-config/service';

export interface Account {
  id: string;
  name: string;
}

export class AccountUtils {
  static flags = {
    account: flags.string({
      description: 'Architect account',
      env: 'ARCHITECT_ACCOUNT',
      char: 'a',
    }),
  };

  static async getAccount(app: AppService, account_name?: string, account_message?: string): Promise<Account> {
    const config_account = app.config.defaultAccount();
    // Set the account name from the config only if an account name wasn't set as cli flag
    if (config_account && !account_name) {
      account_name = config_account;
    }

    if (process.env.ARCHITECT_ACCOUNT === account_name && process.env.ARCHITECT_ACCOUNT) {
      console.log(chalk.blue(`Using account from environment variables: `) + account_name);
    }

    let account: Account;
    if (account_name) {
      account = (await app.api.get(`/accounts/${account_name}`)).data;
      if (!account) {
        throw new Error(`Could not find account=${account_name}`);
      }
    } else {
      inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
      let accounts: Account[] = [];
      const answers: any = await inquirer.prompt([
        {
          type: 'autocomplete',
          name: 'account',
          message: account_message || 'Select an account',
          filter: (x) => x, // api filters
          source: async (answers_so_far: any, input: string) => {
            const { data } = await app.api.get('/accounts', { params: { q: input, limit: 10 } });
            accounts = data.rows;
            return accounts;
          },
        },
      ]);

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      account = accounts.find((account) => account.name === answers.account)!;
      if (!account) {
        throw new Error(`Could not find account=${answers.account}`);
      }
    }
    return account;
  }
}
