import { CliUx, Flags, Interfaces } from '@oclif/core';
import chalk from 'chalk';
import execa from 'execa';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import yaml from 'js-yaml';
import * as path from 'path';
import untildify from 'untildify';
import { ArchitectError, Dictionary, Slugs } from '../../';
import AccountUtils from '../../architect/account/account.utils';
import PipelineUtils from '../../architect/pipeline/pipeline.utils';
import Platform from '../../architect/platform/platform.entity';
import { CreatePlatformInput } from '../../architect/platform/platform.utils';
import BaseCommand from '../../base-command';
import { AgentPlatformUtils } from '../../common/utils/agent-platform.utils';
import { KubernetesPlatformUtils } from '../../common/utils/kubernetes-platform.utils';
import { booleanString } from '../../common/utils/oclif';

export default class PlatformCreate extends BaseCommand {
  static aliases = ['platforms:register', 'platform:create', 'platforms:create'];
  static description = 'Register a new platform with Architect Cloud';
  static examples = [
    'architect platforms:create --account=myaccount',
    'architect platforms:register --account=myaccount --type=kubernetes --kubeconfig=~/.kube/config --auto-approve',
  ];
  static args = [{
    sensitive: false,
    name: 'platform',
    description: 'Name to give the platform',
    parse: async (value: string): Promise<string> => value.toLowerCase(),
  }];

  static flags = {
    ...BaseCommand.flags,
    ...AccountUtils.flags,
    auto_approve: booleanString({
      description: `${BaseCommand.DEPRECATED} Please use --auto-approve.`,
      hidden: true,
      sensitive: false,
      default: false,
    }),
    'auto-approve': booleanString({
      sensitive: false,
      default: false,
    }),
    // TODO https://gitlab.com/architect-io/architect-cli/-/issues/514
    type: Flags.string({
      char: 't',
      options: ['KUBERNETES', 'kubernetes'],
      sensitive: false,
    }),
    host: Flags.string({
      char: 'h',
      sensitive: false,
    }),
    kubeconfig: Flags.string({
      char: 'k',
      default: '~/.kube/config',
      exclusive: ['host'],
      sensitive: false,
    }),
    flag: Flags.string({
      multiple: true,
      default: [],
      sensitive: false,
    }),
  };

  async parse<F, A extends {
    [name: string]: any;
  }>(options?: Interfaces.Input<F>, argv = this.argv): Promise<Interfaces.ParserOutput<F, A>> {
    const parsed = await super.parse(options, argv) as Interfaces.ParserOutput<F, A>;
    const flags: any = parsed.flags;

    // Merge any values set via deprecated flags into their supported counterparts
    flags['auto-approve'] = flags.auto_approve ? flags.auto_approve : flags['auto-approve'];
    parsed.flags = flags;

    return parsed;
  }

  async run(): Promise<void> {
    await this.createPlatform();
  }

  private async installAppliations(flags: any, created_platform: Platform, platform_name: string, account_name: string) {
    if (!flags['auto-approve']) {
      const confirmation = await inquirer.prompt({
        type: 'confirm',
        name: 'application_install',
        message: `Would you like to install the requisite networking applications? This is a required step before using Architect with this platform. More details at the above URL.`,
      });
      if (!confirmation.application_install) {
        this.warn(`Installation cancelled. You will be unable to deploy services to this platform.\n\nIf you decide to proceed with installation, you can do so at the above URL. Or if you would like to deregister this platform from Architect, run: \n\narchitect platform:destroy -a ${account_name} --auto_approve ${platform_name}`);
        return;
      }
    }

    this.log(`Hang tight! This could take as long as 15m, so feel free to grab a cup of coffee while you wait.`);
    CliUx.ux.action.start(chalk.blue('Installing platform applications'));
    const pipeline_id = await this.createPlatformApplications(created_platform.id);
    await PipelineUtils.pollPipeline(this.app, pipeline_id);
    CliUx.ux.action.stop();
  }

  private async createPlatform() {
    const { args, flags } = await this.parse(PlatformCreate);

    const answers: any = await inquirer.prompt([
      {
        type: 'input',
        name: 'platform',
        message: 'What would you like to name your new platform?',
        when: !args.platform,
        filter: value => value.toLowerCase(),
        validate: value => {
          if (Slugs.ArchitectSlugValidator.test(value)) return true;
          return `platform ${Slugs.ArchitectSlugDescription}`;
        },
      },
    ]);

    const platform_name = args.platform || answers.platform;
    if (!Slugs.ArchitectSlugValidator.test(platform_name)) {
      throw new Error(`platform ${Slugs.ArchitectSlugDescription}`);
    }

    const flags_map: Dictionary<boolean> = {};
    for (const flag of flags.flag) {
      flags_map[flag] = true;
    }

    const account = await AccountUtils.getAccount(this.app, flags.account, { account_message: 'Select an account to register the platform with' });

    const kube_contexts = await this.setupKubeContext(flags);

    try {
      const platform_dto = {
        name: platform_name,
        ...await this.createArchitectPlatform(flags, kube_contexts.current_context),
         flags: flags_map,
      };

      CliUx.ux.action.start('Registering platform with Architect');
      const created_platform = await this.postPlatformToApi(platform_dto, account.id);
      CliUx.ux.action.stop();
      this.log(`Platform registered: ${this.app.config.app_host}/${account.name}/platforms/new?platform_id=${created_platform.id}`);

      if (flags.type?.toLowerCase() == 'agent') {
        CliUx.ux.action.start(chalk.blue('Installing the agent'));
        await AgentPlatformUtils.installAgent(flags, created_platform.token.access_token, AgentPlatformUtils.getServerAgentHost(this.app.config.agent_server_host), this.app.config);
        await AgentPlatformUtils.waitForAgent(flags);
        CliUx.ux.action.stop();
        await this.installAppliations(flags, created_platform, account.name, platform_name);
      } else {
        await this.installAppliations(flags, created_platform, account.name, platform_name);
      }
      return created_platform;
    } finally {
      await this.setContext(flags, kube_contexts.original_context);
    }
  }

  async createArchitectPlatform(flags: any, context: any): Promise<CreatePlatformInput> {
    const agent_display_name = 'agent (BETA)';
    const platform_type_answers: any = await inquirer.prompt([
      {
        when: !flags.type,
        type: 'list',
        name: 'platform_type',
        message: 'What type of platform would you like to register?',
        choices: [
          'kubernetes',
          agent_display_name,
          // ...(this.app.config.environment !== ENVIRONMENT.PRODUCTION ? [agent_display_name] : []),
        ],
      },
    ]);
    if (!flags.type && platform_type_answers.platform_type === agent_display_name) {
      platform_type_answers.platform_type = 'agent';
    }

    const selected_type = (flags.type || platform_type_answers.platform_type).toLowerCase();

    flags.type = selected_type;

    switch (selected_type) {
      case 'agent':
        return await AgentPlatformUtils.configureAgentPlatform(flags, context.name);
      case 'kubernetes':
        return await KubernetesPlatformUtils.configureKubernetesPlatform(flags, this.app.config.environment, context);
      case 'architect':
        throw new Error(`You cannot create an Architect platform from the CLI. One Architect platform is registered by default per account.`);
      default:
        throw new Error(`PlatformType=${selected_type} is not currently supported`);
    }
  }

  async createPlatformApplications(platform_id: string): Promise<any> {
    const { data: deployment } = await this.app.api.post(`/platforms/${platform_id}/apps`);
    return deployment.pipeline.id;
  }

  async postPlatformToApi(dto: CreatePlatformInput, account_id: string): Promise<Platform> {
    const { data: platform } = await this.app.api.post(`/accounts/${account_id}/platforms`, dto);
    return platform;
  }

  private async setupKubeContext(flags: any): Promise<{ original_context: any, current_context: any }> {
    let kubeconfig: any;
    const kubeconfig_path = untildify(flags.kubeconfig);
    try {
      kubeconfig = await fs.readFile(path.resolve(kubeconfig_path), 'utf-8');
    } catch {
      throw new Error(`No kubeconfig found at ${kubeconfig_path}`);
    }

    try {
      kubeconfig = yaml.load(kubeconfig);
    } catch {
      throw new Error('Invalid kubeconfig format. Did you provide the correct path?');
    }

    const set_kubeconfig = ['--kubeconfig', untildify(kubeconfig_path), '--namespace', 'default'];

    // Get original kubernetes current-context
    const { stdout: original_kubecontext } = await execa('kubectl', [
      ...set_kubeconfig,
      'config', 'current-context',
    ]);

    let kube_context: any;
    if (flags['auto-approve']) {
      if (kubeconfig.contexts.length === 1) {
        kube_context = kubeconfig.contexts[0];
      } else if (kubeconfig.contexts.length > 1) {
        throw new ArchitectError('Multiple kubeconfig contexts detected');
      } else {
        throw new ArchitectError('No kubeconfig contexts detected');
      }
    } else {
      const new_platform_answers: any = await inquirer.prompt([
        {
          type: 'list',
          name: 'context',
          message: 'Which kube context points to your cluster?',
          choices: kubeconfig.contexts.map((ctx: any) => ctx.name),
          filter: async value => {
            // Set the context to the one the user selected
            await execa('kubectl', [
              ...set_kubeconfig,
              'config', 'set',
              'current-context', value,
            ]);

            // Set the context value to the matching object from the kubeconfig
            return kubeconfig.contexts.find((ctx: any) => ctx.name === value);
          },
        },
      ]);
      kube_context = new_platform_answers.context;
    }

    return {
      original_context: original_kubecontext,
      current_context: kube_context,
    };
  }

  private async setContext(flags: any, context: any) {
    const kubeconfig_path = untildify(flags.kubeconfig);
    const set_kubeconfig = ['--kubeconfig', untildify(kubeconfig_path), '--namespace', 'default'];
    await execa('kubectl', [
      ...set_kubeconfig,
      'config', 'set',
      'current-context', context,
    ]);
  }
}
