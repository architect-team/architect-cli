import { flags } from '@oclif/command';
import { AxiosInstance } from 'axios';
import inquirer from 'inquirer';

export interface Account {
  id: string;
  name: string;
}

export class AccountUtils {
  static flags = {
    account: flags.string({
      description: 'Architect Account',
      env: 'ARCHITECT_ACCOUNT',
      char: 'a',
    }),
  };

  static async getAccount(api: AxiosInstance, account_name?: string, account_message?: string): Promise<Account> {
    let account: Account;
    if (account_name) {
      account = (await api.get(`/accounts/${account_name}`)).data;
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
            const { data } = await api.get('/accounts', { params: { q: input, limit: 10 } });
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
