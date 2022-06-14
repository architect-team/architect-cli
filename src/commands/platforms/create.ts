import { CliUx, Flags, Interfaces } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { Dictionary, Slugs } from '../../';
import AccountUtils from '../../architect/account/account.utils';
import PipelineUtils from '../../architect/pipeline/pipeline.utils';
import { CreatePlatformInput } from '../../architect/platform/platform.utils';
import BaseCommand from '../../base-command';
import { KubernetesPlatformUtils } from '../../common/utils/kubernetes-platform.utils';

export default class PlatformCreate extends BaseCommand {
  static aliases = ['platforms:register', 'platform:create', 'platforms:create'];
  static description = 'Register a new platform with Architect Cloud';

  static args = [{
    non_sensitive: true,
    name: 'platform',
    description: 'Name to give the platform',
    parse: async (value: string): Promise<string> => value.toLowerCase(),
  }];

  static flags = {
    ...BaseCommand.flags,
    ...AccountUtils.flags,
    auto_approve: {
      non_sensitive: true,
      ...Flags.boolean({
        description: `${BaseCommand.DEPRECATED} Please use --auto-approve.`,
        hidden: true,
      })
    },
    ['auto-approve']: {
      non_sensitive: true,
      ...Flags.boolean()
    },
    type: {
      non_sensitive: true,
      ...Flags.string({
        char: 't',
        options: ['KUBERNETES', 'kubernetes']
      })
    },
    host: {
      non_sensitive: true,
      ...Flags.string({
        char: 'h'
      })
    },
    kubeconfig: {
      non_sensitive: true,
      ...Flags.string({
        char: 'k',
        default: '~/.kube/config',
        exclusive: ['host'],
      })
    },
    flag: {
      non_sensitive: true,
      ...Flags.string({ multiple: true, default: [] })
    },
  };

  protected async parse<F, A extends {
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

    const platform = await this.createArchitectPlatform(flags);

    const platform_dto = { name: platform_name, ...platform, flags: flags_map };

    CliUx.ux.action.start('Registering platform with Architect');
    const created_platform = await this.postPlatformToApi(platform_dto, account.id);
    CliUx.ux.action.stop();
    this.log(`Platform registered: ${this.app.config.app_host}/${account.name}/platforms/new?platform_id=${created_platform.id}`);

    if (!flags['auto-approve']) {
      const confirmation = await inquirer.prompt({
        type: 'confirm',
        name: 'application_install',
        message: `Would you like to install the requisite networking applications? This is a required step before using Architect with this platform. More details at the above URL.`,
      });
      if (!confirmation.application_install) {
        this.warn(`Installation cancelled. You will be unable to deploy services to this platform.\n\nIf you decide to proceed with installation, you can do so at the above URL. Or if you would like to deregister this platform from Architect, run: \n\narchitect platform:destroy -a ${account.name} --auto_approve ${platform_name}`);
        return;
      }
    }

    this.log(`Hang tight! This could take as long as 15m, so feel free to grab a cup of coffee while you wait.`);
    CliUx.ux.action.start(chalk.blue('Installing platform applications'));
    const pipeline_id = await this.createPlatformApplications(created_platform.id);
    await PipelineUtils.pollPipeline(this.app, pipeline_id);
    CliUx.ux.action.stop();

    return created_platform;
  }

  async createArchitectPlatform(flags: any): Promise<CreatePlatformInput> {
    const platform_type_answers: any = await inquirer.prompt([
      {
        when: !flags.type,
        type: 'list',
        name: 'platform_type',
        message: 'What type of platform would you like to register?',
        choices: [
          'kubernetes',
        ],
      },
    ]);

    const selected_type = (flags.type || platform_type_answers.platform_type).toLowerCase();

    switch (selected_type) {
      case 'kubernetes':
        return await KubernetesPlatformUtils.configureKubernetesPlatform(flags);
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

  async postPlatformToApi(dto: CreatePlatformInput, account_id: string): Promise<any> {
    const { data: platform } = await this.app.api.post(`/accounts/${account_id}/platforms`, dto);
    return platform;
  }
}
