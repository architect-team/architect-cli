import { flags } from '@oclif/command';
import { AxiosInstance } from 'axios';
import inquirer from 'inquirer';
import { Account } from '../../common/utils/account';

interface Platform {
  id: string;
  name: string;
}

export class PlatformUtils {
  static flags = {
    platform: flags.string({
      description: 'Architect Platform',
      env: 'ARCHITECT_PLATFORM',
    }),
  };

  static async getPlatform(api: AxiosInstance, account: Account, platform_name?: string): Promise<Platform> {
    let platform: Platform;
    if (platform_name) {
      platform = (await api.get(`/accounts/${account.id}/platforms/${platform_name}`)).data;
    } else {
      inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

      // inquirer-autocomplete-prompt doesn't catch exceptions in source...
      const { data } = await api.get(`/accounts/${account.id}/platforms`, { params: { limit: 1 } });
      if (!data.total) {
        throw new Error(`No platform selected. Run 'architect platform:create -a ${account.name}'.`);
      }

      let platforms: Platform[] = [];
      const answers: any = await inquirer.prompt([
        {
          type: 'autocomplete',
          name: 'platform_name',
          message: 'Select a platform',
          filter: (x) => x, // api filters
          source: async (answers_so_far: any, input: string) => {
            const { data } = await api.get(`/accounts/${account.id}/platforms`, { params: { q: input, limit: 10 } });
            platforms = data.rows;
            return platforms;
          },
        },
      ]);

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      platform = platforms.find((platform) => platform.name === answers.platform_name)!;
    }
    return platform;
  }
}
