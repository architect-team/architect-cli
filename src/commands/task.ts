import { CliUx, Flags, Interfaces } from '@oclif/core';
import chalk from 'chalk';
import { ComponentVersionSlugUtils, resourceRefToNodeRef, ResourceSlugUtils } from '../';
import AccountUtils from '../architect/account/account.utils';
import { EnvironmentUtils, GetEnvironmentOptions } from '../architect/environment/environment.utils';
import BaseCommand from '../base-command';
import { DockerComposeUtils } from '../common/docker-compose';
import { RequiresDocker } from '../common/docker/helper';
import { booleanString } from '../common/utils/oclif';

export default class TaskExec extends BaseCommand {
  static aliases = ['task:exec'];
  static description = 'Execute a task in the given environment';

  async auth_required(): Promise<boolean> {
    const { flags } = await this.parse(TaskExec);
    return !flags.local;
  }

  static examples = [
    'architect task --account=myaccount --environment=myenvironment mycomponent:latest mytask',
  ];

  static flags = {
    ...BaseCommand.flags,
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,

    local: booleanString({
      char: 'l',
      description: 'Deploy the stack locally instead of via Architect Cloud',
      exclusive: ['account'],
      sensitive: false,
      default: false,
    }),
    compose_file: Flags.string({
      description: `Please use --compose-file.`,
      exclusive: ['account', 'environment'],
      hidden: true,
      sensitive: false,
      default: undefined,
      deprecated: {
        to: 'compose-file',
      },
    }),
    'compose-file': Flags.string({
      char: 'o',
      description: 'Path where the compose file should be written to',
      default: '',
      exclusive: ['account', 'environment'],
      sensitive: false,
    }),
  };

  static args = [
    {
      sensitive: false,
      name: 'component',
      description: 'The name of the component that contains the task to execute',
      required: true,
    },
    {
      sensitive: false,
      name: 'task',
      description: 'The name of the task to execute',
      required: true,
    },
  ];

  async parse<F, A extends {
    [name: string]: any;
  }>(options?: Interfaces.Input<F, A>, argv = this.argv): Promise<Interfaces.ParserOutput<F, A>> {
    const parsed = await super.parse(options, argv) as Interfaces.ParserOutput<F, A>;
    const flags: any = parsed.flags;

    // Merge any values set via deprecated flags into their supported counterparts
    flags['compose-file'] = flags.compose_file ? flags.compose_file : flags['compose-file'];
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

  @RequiresDocker({ compose: true })
  async runLocal(): Promise<void> {
    const { flags, args } = await this.parse(TaskExec);

    let parsed_slug;
    try {
      parsed_slug = ComponentVersionSlugUtils.parse(args.component);
    } catch (err) {
      throw new Error(`Error parsing component: ${err}`);
    }

    const project_name = flags.environment || DockerComposeUtils.DEFAULT_PROJECT;
    const compose_file = flags['compose-file'] || DockerComposeUtils.buildComposeFilepath(this.app.config.getConfigDir(), project_name);

    let compose;
    try {
      compose = DockerComposeUtils.loadDockerCompose(compose_file);
    } catch (err) {
      throw new Error(`Could not find docker compose file at ${compose_file}. Please run \`architect dev -e ${project_name} ${args.component}\` before executing any tasks in your local ${project_name} environment.`);
    }

    const slug = ResourceSlugUtils.build(parsed_slug.component_name, 'tasks', args.task, parsed_slug.instance_name);
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
    const get_environment_options: GetEnvironmentOptions = { environment_name: flags.environment };
    const environment = await EnvironmentUtils.getEnvironment(this.app.api, selected_account, get_environment_options);

    let parsed_slug;
    try {
      parsed_slug = ComponentVersionSlugUtils.parse(args.component);
    } catch (err) {
      throw new Error(`Error parsing component: ${err}`);
    }

    CliUx.ux.action.start(chalk.blue(`Kicking off task ${args.component}/${args.task} in ${flags.environment}...`));
    const res = await this.app.api.post(`/environments/${environment.id}/exec`, {
      component_account_name: selected_account.name,
      component_name: parsed_slug.component_name,
      instance_name: parsed_slug.instance_name,
      task_name: args.task,
    });
    CliUx.ux.action.stop();

    this.log(chalk.green(`Successfully kicked off task. ${environment.cluster.type.toLowerCase()} reference= ${res.data}`));
  }
}
