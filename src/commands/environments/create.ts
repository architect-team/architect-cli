import { CliUx, Flags } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { Dictionary, Slugs } from '../../';
import AccountUtils from '../../architect/account/account.utils';
import ClusterUtils from '../../architect/cluster/cluster.utils';
import BaseCommand from '../../base-command';
import { booleanString } from '../../common/utils/oclif';
import axios from 'axios';

interface CreateEnvironmentDto {
  name: string;
  description?: string;
  cluster_id: string;
  ttl?: string;
  flags: Dictionary<boolean>;
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
    strict: booleanString({
      description: 'If set to true, throws an error when attempting to create an environment that already exists',
      hidden: true,
      default: false,
      sensitive: false,
    }),
    ttl: Flags.string({
      description: 'The TTL of the environment in a duration of time, ex. 30d, 12h, or 30m',
      sensitive: false,
    }),
    flag: Flags.string({
      multiple: true,
      default: [],
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

    const answers = await inquirer.prompt([
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
    const cluster = await ClusterUtils.getCluster(this.app.api, account, flags.cluster || flags.platform);

    const flags_map: Dictionary<boolean> = {};
    for (const flag of flags.flag) {
      flags_map[flag] = true;
    }

    CliUx.ux.action.start(chalk.blue('Registering environment with Architect'));

    const dto: CreateEnvironmentDto = {
      name: environment_name,
      description: flags.description,
      cluster_id: cluster.id,
      flags: flags_map,
    };
    if (flags.ttl) {
      dto.ttl = flags.ttl;
    }

    let _environment_already_exists = false;
    await this.app.api.post(`/accounts/${account.id}/environments`, dto, {
      validateStatus: function (status): boolean {
        _environment_already_exists = status === 409;
        return status === 201 || (_environment_already_exists && flags.strict === false);
      },
    });

    CliUx.ux.action.stop();

    if (_environment_already_exists) {
      this.warn(`Unable to create new environment '${environment_name}'.\nEnvironment name already in use for account '${account.name}'`);
      return;
    }

    const environment_url = `${this.app.config.app_host}/${account.name}/environments/${environment_name}`;
    this.log(chalk.green(`Environment created: ${environment_url}`));
  }
}
