import { CliUx, Flags } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { Slugs } from '../../';
import AccountUtils from '../../architect/account/account.utils';
import ClusterUtils from '../../architect/cluster/cluster.utils';
import BaseCommand from '../../base-command';

interface CreateEnvironmentDto {
  name: string;
  description?: string;
  cluster_id: string;
  ttl?: string;
}

export default class EnvironmentCreate extends BaseCommand {
  static aliases = ['environment:create', 'envs:create', 'env:create'];
  static description = 'Register a new environment with Architect Cloud';
  static examples = [
    'environment:create --account=myaccount myenvironment',
    'environment:create --account=myaccount --ttl=5days --description="My new temporary Architect environment" myenvironment',
  ];
  static flags = {
    ...BaseCommand.flags,
    ...AccountUtils.flags,
    ...ClusterUtils.flags,
    description: Flags.string({
      description: 'Environment Description',
      sensitive: false,
    }),
    ttl: Flags.string({
      description: 'The TTL of the environment in a duration of time, ex. 30d, 12h, or 30m',
      sensitive: false,
    }),
  };

  static args = [{
    sensitive: false,
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

    const account = await AccountUtils.getAccount(this.app, flags.account, { account_message: 'Select an account to register the environment with' });
    const cluster = await ClusterUtils.getCluster(this.app.api, account, flags.cluster);

    CliUx.ux.action.start(chalk.blue('Registering environment with Architect'));

    const dto: CreateEnvironmentDto = {
      name: environment_name,
      description: flags.description,
      cluster_id: cluster.id,
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
