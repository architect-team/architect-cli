import { Flags } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import Account from '../architect/account/account.entity';
import AccountUtils from '../architect/account/account.utils';
import { ComponentVersion } from '../architect/component/component-version.entity';
import Environment from '../architect/environment/environment.entity';
import { EnvironmentUtils, GetEnvironmentOptions } from '../architect/environment/environment.utils';
import BaseCommand from '../base-command';
import { IF_EXPRESSION_REGEX } from '../dependency-manager/spec/utils/interpolation';
import { ComponentVersionSlugUtils, ResourceSlugUtils } from '../dependency-manager/spec/utils/slugs';

export default class Scale extends BaseCommand {
  static description = 'Scale a service to a specified number of replicas.';

  static examples = [
    'architect scale api --component my-component --replicas 4',
    'architect scale api --component my-component --clear',
  ];

  static flags = {
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,
    component: Flags.string({
      description: 'Name of the component with the service to scale',
      sensitive: false,
    }),
    tag: Flags.string({
      description: 'Tag of the component to scale',
      sensitive: false,
    }),
    replicas: Flags.integer({
      description: 'Number of desired service replicas',
      sensitive: false,
    }),
    clear: Flags.boolean({
      description: 'Use to clear scaling settings for the specified service in the specified environment',
      default: false,
    }),
  };

  static args = [{
    sensitive: false,
    name: 'service',
    description: 'Name of service',
    required: false,
    parse: async (value: string): Promise<string> => value.toLowerCase(),
  }];

  async run(): Promise<void> {
    this.log(chalk.yellow(
      `This feature is in alpha. While the feature should be stable, it may be changed or removed without prior notice. As such we do not recommend using this feature in any automated pipelines.
During this time we greatly appreciate any feedback as we continue to finalize the implementation. You can reach us at support@architect.io.`,
    ));
    const { args, flags } = await this.parse(Scale);

    const account: Account = await AccountUtils.getAccount(this.app, flags.account);
    const tag = flags.tag || 'latest';

    let component_version: ComponentVersion;
    if (flags.component) {
      if (flags.tag) {
        component_version = (await this.app.api.get(`/accounts/${account.id}/components/${flags.component}/versions/${tag}`)).data;
      } else { // get latest if no tag specified
        component_version = (await this.app.api.get(`/accounts/${account.id}/components/${flags.component}`)).data;
      }
    } else {
      // eslint-disable-next-line unicorn/prefer-module
      inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
      const answers: { component_version: ComponentVersion } = await inquirer.prompt([
        {
          type: 'autocomplete',
          name: 'component_version',
          message: 'Select a component',
          filter: (x) => x, // api filters
          source: async (answers_so_far: any, input: string) => {
            const { data } = await this.app.api.get(`/accounts/${account.id}/components`, { params: { q: input, limit: 10 } });
            const latest_component_versions = data.rows as ComponentVersion[];
            return latest_component_versions.map((c: ComponentVersion) => ({ name: c.component.name, value: c }));
          },
        },
      ]);
      component_version = answers.component_version;
    }

    let service_name: string;
    if (args.service) {
      service_name = args.service;
      if (!Object.keys(component_version.config.services || {}).includes(service_name)) {
        const component_version_slug = ComponentVersionSlugUtils.build(account.name, component_version.component.name, tag);
        throw new Error(`Component version ${component_version_slug} does not have a service named ${args.service}.`);
      }
    } else {
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'service_name',
          message: `What is the name of the component's service to scale?`,
          choices: Object.keys(component_version.config.services || {}).filter(name => !IF_EXPRESSION_REGEX.test(name)),
        },
      ]);
      service_name = answers.service_name;
    }

    let replicas;
    if (!flags.clear) {
      if (flags.replicas) {
        replicas = flags.replicas;
      } else {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'replicas',
            message: `How many replicas should the service be scaled to?`,
            validate: (value) => {
              if (Number.isNaN(value) || value % 1 !== 0) {
                return 'Must be a whole number';
              }
              return true;
            },
          },
        ]);
        replicas = answers.replicas;
      }
      replicas = Number.parseInt(replicas);
    }
    const getEnvironmentOptions: GetEnvironmentOptions = { environment_name: flags.environment };
    const environment: Environment = await EnvironmentUtils.getEnvironment(this.app.api, account, getEnvironmentOptions);

    const resource_slug = ResourceSlugUtils.build(undefined, component_version.component.name, 'services', service_name);
    const scaling_dto = {
      resource_slug,
      replicas,
    };
    const update_env_dto = {
      ...scaling_dto,
      clear_scaling: Boolean(flags.clear) || undefined,
    };
    if (!flags.clear) {
      try {
        await this.app.api.put(`/environments/${environment.id}/scale`, scaling_dto);
        this.log(chalk.green(`Scaled service ${service_name} of component ${account.name}/${component_version.component.name} deployed to environment ${environment.name} to ${replicas} replicas`));
      } catch (err: any) {
        this.log(chalk.yellow(err.response.data.message));
        const environment_url = `${this.app.config.app_host}/${account.name}/environments/${environment.name}`;
        this.log(chalk.yellow(`Did not immediately scale service ${service_name} of component ${account.name}/${component_version.component.name}.\nIf this was unexpected, check to see that the service is deployed to the environment ${environment.name} at\n${environment_url}.`));
      }
    }
    await this.app.api.put(`/environments/${environment.id}`, update_env_dto);
    this.log(chalk.green(`Updated scaling settings for service ${service_name} of component ${component_version.component.name} for environment ${environment.name}`));
  }
}
