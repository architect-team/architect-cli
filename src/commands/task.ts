import { CliUx, Flags, Interfaces } from '@oclif/core';
import chalk from 'chalk';
import AccountUtils from '../architect/account/account.utils';
import { EnvironmentUtils } from '../architect/environment/environment.utils';
import Command from '../base-command';
import { DockerComposeUtils } from '../common/docker-compose';
import * as Docker from '../common/utils/docker';
import { ComponentVersionSlugUtils, resourceRefToNodeRef, ResourceSlugUtils } from '../dependency-manager/src';

export default class TaskExec extends Command {
  static aliases = ['task:exec'];
  static description = 'Execute a task in the given environment';

  async auth_required(): Promise<boolean> {
    const { flags } = await this.parse(TaskExec);
    return !flags.local;
  }

  static flags = {
    ...Command.flags,
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,

    local: Flags.boolean({
      char: 'l',
      description: 'Deploy the stack locally instead of via Architect Cloud',
      exclusive: ['account', 'auto-approve', 'auto_approve', 'refresh'],
    }),
    compose_file: Flags.string({
      description: `${Command.DEPRECATED} Please use --compose-file.`,
      exclusive: ['account', 'environment', 'auto-approve', 'auto_approve', 'refresh'],
      hidden: true,
    }),
    'compose-file': Flags.string({
      char: 'o',
      description: 'Path where the compose file should be written to',
      default: '',
      exclusive: ['account', 'environment', 'auto-approve', 'auto_approve', 'refresh'],
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

  protected async parse<F, A extends {
    [name: string]: any;
  }>(options?: Interfaces.Input<F>, argv = this.argv): Promise<Interfaces.ParserOutput<F, A>> {
    const parsed = await super.parse(options, argv) as Interfaces.ParserOutput<F, A>;
    const flags: any = parsed.flags;

    // Merge any values set via deprecated flags into their supported counterparts
    flags['compose-file'] = flags.compose_file ? flags.compose_file : flags['compose-file'];
    flags['auto-approve'] = flags.auto_approve ? flags.auto_approve : flags['auto-approve'];
    parsed.flags = flags;

    return parsed;
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(TaskExec);

    if (flags.local) {
      await this.runLocal();
    } else {
      await this.runRemote();
    }
  }

  async runLocal(): Promise<void> {
    const { flags, args } = await this.parse(TaskExec);
    await Docker.verify();

    const project_name = flags.environment || DockerComposeUtils.DEFAULT_PROJECT;
    const compose_file = flags['compose-file'] || DockerComposeUtils.buildComposeFilepath(this.app.config.getConfigDir(), project_name);

    let compose;
    try {
      compose = DockerComposeUtils.loadDockerCompose(compose_file);
    } catch (err) {
      throw new Error(`Could not find docker compose file at ${compose_file}. Please run \`architect dev -e ${project_name} ${args.component}\` before executing any tasks in your local ${project_name} environment.`);
    }

    let parsed_slug;
    try {
      parsed_slug = ComponentVersionSlugUtils.parse(args.component);
    } catch (err) {
      throw new Error(`Error parsing component: ${err}`);
    }

    const slug = ResourceSlugUtils.build(parsed_slug.component_account_name, parsed_slug.component_name, 'tasks', args.task, parsed_slug.instance_name);
    const ref = resourceRefToNodeRef(slug);
    const service_name = Object.keys(compose.services).find(name => name === ref);
    if (!service_name) {
      throw new Error(`Could not find ${slug} running in your local ${project_name} environment. See ${compose_file} for available tasks and services.`);
    }

    this.log(chalk.blue(`Running task ${slug} in the local ${project_name} environment...`));
    this.log('\n');
    // all tasks will already exist in the docker-compose file with scale=0; all we need to do is a `run --rm` to start them and clean them up upon exit
    await DockerComposeUtils.run(service_name, project_name, compose_file);
    this.log('\n');
    this.log(chalk.green(`Successfully ran task.`));
  }

  async runRemote(): Promise<void> {
    const { flags, args } = await this.parse(TaskExec);

    const selected_account = await AccountUtils.getAccount(this.app, flags.account);
    const environment = await EnvironmentUtils.getEnvironment(this.app.api, selected_account, flags.environment);

    let parsed_slug;
    try {
      parsed_slug = ComponentVersionSlugUtils.parse(args.component);
    } catch (err) {
      throw new Error(`Error parsing component: ${err}`);
    }

    CliUx.ux.action.start(chalk.blue(`Kicking off task ${args.component}/${args.task} in ${flags.environment}...`));
    const res = await this.app.api.post(`/environments/${environment.id}/exec`, {
      component_account_name: parsed_slug.component_account_name,
      component_name: parsed_slug.component_name,
      instance_name: parsed_slug.instance_name,
      task_name: args.task,
    });
    CliUx.ux.action.stop();

    this.log(chalk.green(`Successfully kicked off task. ${environment.platform.type.toLowerCase()} reference= ${res.data}`));
  }
}
