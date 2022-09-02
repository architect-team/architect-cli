import { Flags } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import Account from '../architect/account/account.entity';
import AccountUtils from '../architect/account/account.utils';
import Environment from '../architect/environment/environment.entity';
import { EnvironmentUtils } from '../architect/environment/environment.utils';
import BaseCommand from '../base-command';
import { ComponentVersionSlugUtils, ResourceSlugUtils } from '../dependency-manager/spec/utils/slugs';
import { ComponentVersion } from './components/versions';

// export type ScalingSettings = Dictionary<Dictionary<{ replicas?: number }>>; // TODO: export and use for API as well?

export default class Scale extends BaseCommand {
  static description = 'Scale a service to a specified number of replicas.';

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
  };

  static args = [{
    sensitive: false,
    name: 'component_name',
    description: 'Name of service to scale, ex. account/component:latest',
  }];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Scale);

    const { component_account_name, component_name, tag, instance_name } = ComponentVersionSlugUtils.parse(args.component_name);
    if (!component_account_name || !component_name) {
      throw new Error(`Couldn't successfully parse the component version name ${args.component_name}. Please specify it in the format account/component:latest`);
    }

    const component_tag = tag || 'latest';
    const account: Account = await AccountUtils.getAccount(this.app, flags.account);
    const environment: Environment = await EnvironmentUtils.getEnvironment(this.app.api, account, flags.environment);

    const { data: component } = await this.app.api.get(`/accounts/${component_account_name}/components/${component_name}`);
    const component_version: ComponentVersion = (await this.app.api.get(`/components/${component.component_id}/versions/${component_tag}`)).data;
    let service_name: string;
    if (flags.service) {
      service_name = flags.service;
      if (!Object.keys(component_version.config.services || {}).includes(service_name)) {
        throw new Error(`Component version ${args.component_name} does not have a service called ${flags.service}.`);
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

    const resource_slug = ResourceSlugUtils.build(account.name, component_name, 'services', service_name, instance_name);
    const dto = {
      resource_slug,
      // tag: component_tag, // TODO: remove the tag?
      replicas: flags.replicas,
    };
    try {
      await this.app.api.put(`/environments/${environment.id}/scale`, dto);
      this.log(chalk.green(`Scaled service ${service_name} of component ${component_account_name}/${component_name} deployed to environment ${environment.name} to ${flags.replicas} replicas`));
    } catch(err) {
      const environment_url = `${this.app.config.app_host}/${account.name}/environments/${environment.name}`;
      this.warn(chalk.yellow(`Did not immediately scale service ${service_name} of component ${component_account_name}/${component_name}.\nIf this was unexpected, check to see that the service is deployed to the environment ${environment.name} at\n${environment_url}.`));
    }

    // TODO: warning if service isn't running and couldn't scale immediately
    // TODO: warning about alpha release

    await this.app.api.put(`/environments/${environment.id}`, dto);
    this.log(chalk.green(`Updated scaling settings for service ${service_name} of component ${component_name} for environment ${environment.name}`));
  }
}
