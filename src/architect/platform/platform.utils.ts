import { Flags } from '@oclif/core';
import { AxiosInstance } from 'axios';
import chalk from 'chalk';
import inquirer from 'inquirer';
import Account from '../account/account.entity';
import Platform from './platform.entity';

export interface CreatePlatformInput {
  type: string;
  description: string;
  credentials: PlatformCredentials;
}

export type PlatformCredentials = KubernetesPlatformCredentials | EcsPlatformCredentials;

export interface KubernetesPlatformCredentials {
  kind: 'KUBERNETES';

  host: string;
  cluster_ca_cert: string;
  service_token: string;
}

export interface EcsPlatformCredentials {
  kind: 'ECS';

  region: string;
  access_key: string;
  access_secret: string;
}

export default class PlatformUtils {
  static flags = {
    platform: Flags.string({
      description: 'Architect platform',
      env: 'ARCHITECT_PLATFORM',
      parse: async value => value.toLowerCase(),
    }),
  };

  static async getPlatform(api: AxiosInstance, account: Account, platform_name?: string): Promise<Platform> {
    if (process.env.ARCHITECT_PLATFORM === platform_name && process.env.ARCHITECT_PLATFORM) {
      console.log(chalk.blue(`Using platform from environment variables: `) + platform_name);
    }

    let platform: Platform;
    if (platform_name) {
      platform = (await api.get(`/accounts/${account.id}/platforms/${platform_name}`)).data;
    } else {
      inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

      // inquirer-autocomplete-prompt doesn't catch exceptions in source...
      const { data } = await api.get(`/accounts/${account.id}/platforms`, { params: { limit: 1 } });
      if (!data.total) {
        throw new Error(`No configured platforms. Run 'architect platform:create -a ${account.name}'.`);
      }

      let platforms: Platform[] = [];
      const answers: any = await inquirer.prompt([
        {
          type: 'autocomplete',
          name: 'platform',
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
      platform = platforms.find((platform) => platform.name === answers.platform)!;
    }
    return platform;
  }
}
