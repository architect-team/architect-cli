import { Flags } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import Account from '../architect/account/account.entity';
import AccountUtils from '../architect/account/account.utils';
import Environment from '../architect/environment/environment.entity';
import { EnvironmentUtils } from '../architect/environment/environment.utils';
import BaseCommand from '../base-command';
import { ComponentVersionSlugUtils } from '../dependency-manager/spec/utils/slugs';
import { Dictionary } from '../dependency-manager/utils/dictionary';
import { ComponentVersion } from './components/versions';

export type ScalingSettings = Dictionary<Dictionary<{ min?: number, max?: number, replicas?: number }>>; // TODO: export and use for API as well?

export default class Scale extends BaseCommand {
  static description = 'Scale services and update settings for service scaling. Leaving out min, max, or replicas will unset it.';

  static flags = {
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,
    service: Flags.string({
      description: 'Name of the service to scale',
      sensitive: false,
    }),
    replicas: Flags.integer({
      name: 'replicas',
      description: 'Number of desired service replicas',
      sensitive: false,
    }),
    min: Flags.integer({
      description: 'Min number of service replicas',
      sensitive: false,
    }),
    max: Flags.integer({
      description: 'Max number of service replicas',
      sensitive: false,
    }), // TODO: cpu and memory scaling metrics + add tests for them
  }; // TODO: add cpu/memory metrics here or just in the UI?

  static args = [{
    sensitive: false,
    name: 'component_name',
    description: 'Name of service to scale, ex. account/component:latest',
  }];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Scale);

    const { component_account_name, component_name, tag, instance_name } = ComponentVersionSlugUtils.parse(args.component_name);

    const account: Account = await AccountUtils.getAccount(this.app, flags.account);
    const environment: Environment = await EnvironmentUtils.getEnvironment(this.app.api, account, flags.environment);

    const { data: component } = await this.app.api.get(`/accounts/${account.name}/components/${component_name}`);
    const component_version: ComponentVersion = (await this.app.api.get(`/components/${component.component_id}/versions/${tag || 'latest'}`)).data;
    const component_version_name = ComponentVersionSlugUtils.build(component_account_name, component_name, tag, instance_name);
// TODO: test that a valid component version must be supplied
    let service_name: string;
    if (flags.service) {
      service_name = flags.service;
      if (!Object.keys(component_version.config.services || {}).includes(service_name)) {
        throw new Error(`Component version ${component_version_name} does not have a service called ${flags.service}.`);
      }
    } else {
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'service_name',
          message: `What is the name of the component's service to scale?`,
          choices: Object.keys(component_version.config.services || {}),
        },
      ]);
      service_name = answers.service_name;
    }

    const scaling_settings: ScalingSettings = {};
    scaling_settings[component_version_name] = {};
    scaling_settings[component_version_name][service_name] = { min: flags.min, max: flags.max, replicas: flags.replicas };
    // TODO: run k8s command to scale env
    await this.app.api.put(`/environments/${environment.id}`, { scaling_settings });
    this.log(chalk.green(`Updated scaling settings for service ${service_name} of component ${component_name} in environment ${environment.name}`));
  }
}
