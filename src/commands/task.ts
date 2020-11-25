import { flags } from '@oclif/command';
import chalk from 'chalk';
import { cli } from 'cli-ux';
import path from 'path';
import Command from '../base-command';
import { DockerComposeUtils } from '../common/docker-compose';
import { AccountUtils } from '../common/utils/account';
import { EnvironmentUtils } from '../common/utils/environment';
import { ComponentVersionSlugUtils, Refs, ServiceVersionSlugUtils } from '../dependency-manager/src';
import ARCHITECTPATHS from '../paths';

export default class TaskExec extends Command {
  static aliases = ['task:exec'];
  static description = 'Execute a task in the given environment';

  auth_required() {
    const { flags } = this.parse(TaskExec);
    return !flags.local;
  }

  static flags = {
    ...Command.flags,
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,

    local: flags.boolean({
      char: 'l',
      description: 'Deploy the stack locally instead of via Architect Cloud',
      exclusive: ['account', 'environment', 'auto_approve', 'lock', 'force_unlock', 'refresh'],
    }),
    compose_file: flags.string({
      char: 'o',
      description: 'Path where the compose file should be written to',
      default: '',
      exclusive: ['account', 'environment', 'auto_approve', 'lock', 'force_unlock', 'refresh'],
    }),
  };

  static args = [
    {
      name: 'component',
      description: 'The name of the component that contains the task to execute',
      required: true,
    },
    {
      name: 'task',
      description: 'The name of the task to execute',
      required: true,
    },
  ];

  async run() {
    const { flags } = this.parse(TaskExec);

    if (flags.local) {
      await this.runLocal();
    } else {
      await this.runRemote();
    }
  }

  async runLocal() {
    const { flags, args } = this.parse(TaskExec);

    if (!flags.compose_file) {
      flags.compose_file = path.join(this.app.config.getConfigDir(), ARCHITECTPATHS.LOCAL_DEPLOY_FILENAME);
    }

    let compose;
    try {
      compose = DockerComposeUtils.loadDockerCompose(flags.compose_file);
    } catch (err) {
      throw new Error('Could not find docker compose file. Please run `architect deploy --local` before executing any tasks in your local environment.');
    }

    let parsed_slug;
    try {
      parsed_slug = ComponentVersionSlugUtils.parse(args.component);
    } catch (err) {
      throw new Error(`Error parsing component: ${err}`);
    }

    let service_name;
    const slug = ServiceVersionSlugUtils.build(parsed_slug.component_account_name, parsed_slug.component_name, args.task, parsed_slug.tag);
    const ref = Refs.url_safe_ref(slug);
    const matching_names = Object.keys(compose.services).filter(name => name.includes(ref));
    if (!matching_names?.length) {
      throw new Error(`Could not find ${args.component}/${args.task} running in your local environment. See ${ARCHITECTPATHS.LOCAL_DEPLOY_FILENAME} for available tasks and services.`);
    } else if (matching_names.length > 1) {
      throw new Error(`There was more than one task in your local environment that matched ${args.component}/${args.task} running in your local environment. See ${ARCHITECTPATHS.LOCAL_DEPLOY_FILENAME} for available tasks and services.`);
    } else {
      service_name = matching_names[0];
    }

    this.log(chalk.blue(`Running task ${args.component}/${args.task} in the local docker-compose environment...`));
    // all tasks will already exist in the docker-compose file with scale=0; all we need to do is a `run --rm` to start them and clean them up upon exit
    await DockerComposeUtils.run(service_name, flags.compose_file);
    this.log(chalk.green(`Successfully ran task.`));
  }

  async runRemote() {
    const { flags, args } = this.parse(TaskExec);

    const selected_account = await AccountUtils.getAccount(this.app.api, flags.account);
    const environment = await EnvironmentUtils.getEnvironment(this.app.api, selected_account, flags.environment);

    let parsed_slug;
    try {
      parsed_slug = ComponentVersionSlugUtils.parse(args.component);
    } catch (err) {
      throw new Error(`Error parsing component: ${err}`);
    }

    cli.action.start(chalk.blue(`Kicking off task ${args.component}/${args.task} in ${flags.environment}...`));
    const res = await this.app.api.post(`/environments/${environment.id}/exec`, {
      component_account_name: parsed_slug.component_account_name,
      component_name: parsed_slug.component_name,
      task_name: args.task,
      tag: parsed_slug.tag,
    });
    cli.action.stop();

    this.log(chalk.green(`Successfully kicked off task. ${environment.platform.type.toLowerCase()} reference= ${res.data}`));
  }
}
