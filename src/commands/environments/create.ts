import { CliUx, Flags } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import AccountUtils from '../../architect/account/account.utils';
import PlatformUtils from '../../architect/platform/platform.utils';
import Command from '../../base-command';
import { Slugs } from '../../dependency-manager/src';

interface CreateEnvironmentDto {
  name: string;
  description?: string;
  platform_id: string;
  ttl?: string;
}

export default class EnvironmentCreate extends Command {
  static aliases = ['environment:create', 'envs:create', 'env:create'];
  static description = 'Register a new environment with Architect Cloud';

  static flags = {
    ...Command.flags,
    ...AccountUtils.flags,
    ...PlatformUtils.flags,
    description: Flags.string({
      description: 'Environment Description',
    }),
    ttl: Flags.string({
      description: 'The TTL of the environment in a duration of time, ex. 30d, 12h, or 30m',
    }),
  };

  static args = [{
    name: 'environment',
    description: 'Name to give the environment',
    parse: async (value: string): Promise<string> => value.toLowerCase(),
  }];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(EnvironmentCreate);

    const answers: any = await inquirer.prompt([
      {
        type: 'input',
        name: 'environment',
        message: 'What would you like to name your new environment?',
        when: !args.environment,
        filter: value => value.toLowerCase(),
        validate: value => {
          if (Slugs.ArchitectSlugValidator.test(value)) return true;
          return `environment ${Slugs.ArchitectSlugDescription}`;
        },
      },
    ]);

    const environment_name = args.environment || answers.environment;
    if (!Slugs.ArchitectSlugValidator.test(environment_name)) {
      throw new Error(`environment ${Slugs.ArchitectSlugDescription}`);
    }

    const account = await AccountUtils.getAccount(this.app, flags.account, 'Select an account to register the environment with');
    const platform = await PlatformUtils.getPlatform(this.app.api, account, flags.platform);

    CliUx.ux.action.start(chalk.blue('Registering environment with Architect'));

    const dto: CreateEnvironmentDto = {
      name: environment_name,
      description: flags.description,
      platform_id: platform.id,
    };
    if (flags.ttl) {
      dto.ttl = flags.ttl;
    }
    await this.app.api.post(`/accounts/${account.id}/environments`, dto);

    const environment_url = `${this.app.config.app_host}/${account.name}/environments/${environment_name}`;
    CliUx.ux.action.stop();
    this.log(chalk.green(`Environment created: ${environment_url}`));
  }
}
