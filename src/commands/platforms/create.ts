import { flags } from '@oclif/command';
import chalk from 'chalk';
import { cli } from 'cli-ux';
import inquirer from 'inquirer';
import Command from '../../base-command';
import { EcsPlatformUtils } from '../../common/utils/ecs-platform.utils';
import { KubernetesPlatformUtils } from '../../common/utils/kubernetes-platform.utils';
import { EnvironmentNameValidator } from '../../common/utils/validation';

export interface CreatePlatformInput {
  type: string;
  description: string;
  credentials: PlatformCredentials;
}

export interface CreatePublicPlatformInput {
  name: string;
}

export type PlatformCredentials = KubernetesPlatformCredentials | EcsPlatformCredentials;

export interface KubernetesPlatformCredentials {
  kind: 'KUBERNETES';

  host: string;
  cluster_ca_cert: string;
  service_token: string;
}

export interface EcsPlatformCredentials {
  kind: 'ECS';

  region: string;
  access_key: string;
  access_secret: string;
}

export default class PlatformCreate extends Command {
  static aliases = ['platform:create', 'platforms:create'];
  static description = 'Register a new platform with Architect Cloud';

  platforms = [];

  static args = [{
    name: 'name',
    description: 'Name to give the platform',
    parse: (value: string) => value.toLowerCase(),
  }];

  static flags = {
    ...Command.flags,
    type: flags.string({ char: 't', options: ['KUBERNETES', 'kubernetes', 'ARCHITECT_PUBLIC', 'architect_public', 'ECS', 'ecs'] }),
    host: flags.string({ char: 'h' }),
    kubeconfig: flags.string({ char: 'k', default: '~/.kube/config', exclusive: ['service_token', 'cluster_ca_cert', 'host'] }),
    aws_key: flags.string({ exclusive: ['awsconfig', 'kubeconfig', 'service_token', 'cluster_ca_cert', 'host'] }),
    aws_secret: flags.string({ exclusive: ['awsconfig', 'kubeconfig', 'service_token', 'cluster_ca_cert', 'host'] }),
    aws_region: flags.string({ exclusive: ['awsconfig', 'kubeconfig', 'service_token', 'cluster_ca_cert', 'host'] }),
    service_token: flags.string({ description: 'Service token', env: 'ARCHITECT_SERVICE_TOKEN' }),
    cluster_ca_cert: flags.string({ description: 'File path of cluster_ca_cert', env: 'ARCHITECT_CLUSTER_CA_CERT' }),
    config_file: flags.string({ char: 'c' }),
    account: flags.string({ char: 'a' }),
    platform: flags.string({ char: 'p', exclusive: ['type', 'kubeconfig', 'service_token', 'cluster_ca_cert', 'host'] }),
  };

  async run() {
    const platform = await this.create_platform();
    this.log(chalk.green('Platform created successfully'));
    this.log(`${this.app.config.app_host}/${platform.account.name}/platforms/`);
  }

  private async create_platform() {
    const { args, flags } = this.parse(PlatformCreate);

    this.platforms = await this.load_platforms();

    let selected_account: any;
    this.accounts = await this.get_accounts();

    if (flags.account) {
      selected_account = this.accounts.rows.find((a: any) => a.name === flags.account);
      if (!selected_account) {
        throw new Error(`Account=${flags.account} does not exist or you do not have access to it.`);
      }
    }

    // Prompt user for required inputs
    const answers: any = await inquirer.prompt([
      {
        when: () => !flags.account,
        type: 'list',
        name: 'account',
        message: 'For which Architect account would you like to create this platform?',
        choices: this.accounts.rows.map((a: any) => { return { name: a.name, value: a }; }),
        default: selected_account,
      },
      {
        type: 'input',
        name: 'name',
        message: 'What would you like to name your new platform?',
        when: !args.name,
        filter: value => value.toLowerCase(),
        validate: value => {
          if (EnvironmentNameValidator.test(value)) return true;
          return `Name must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character`;
        },
      },
    ]);

    if (selected_account) {
      answers.account = selected_account;
    }

    const platform = await this.create_architect_platform(flags);
    const platform_dto = { name: args.name || answers.name, ...platform };

    cli.action.start('Registering platform with Architect');
    const public_platform = Object.keys(platform_dto).length === 1 && !!platform_dto.name;
    const created_platform = await this.post_platform_to_api(platform_dto, answers.account.id, public_platform);
    cli.action.stop();

    return created_platform;
  }

  private async create_architect_platform(flags: any) {
    const platform_type_answers: any = await inquirer.prompt([
      {
        when: !flags.type,
        type: 'list',
        name: 'platform_type',
        message: 'What type of platform would you like to register?',
        choices: [
          'KUBERNETES',
          'ECS',
          'ARCHITECT_PUBLIC',
        ],
      },
    ]);

    const selected_type = (flags.type || platform_type_answers.platform_type).toUpperCase();

    switch (selected_type) {
      case 'KUBERNETES':
        return await KubernetesPlatformUtils.configure_kubernetes_platform(flags);
      case 'ECS':
        return await EcsPlatformUtils.configure_ecs_platform(flags);
      case 'ARCHITECT_PUBLIC':
        return {};
      default:
        throw new Error(`PlatformType=${selected_type} is not currently supported`);
    }
  }

  private async load_platforms(account_id?: string) {
    const endpoint = account_id ? `/platforms?account_id=${account_id}` : `/platforms`;
    const { data: { rows: platforms } } = await this.app.api.get(endpoint);
    return platforms;
  }

  private async post_platform_to_api(dto: CreatePlatformInput | CreatePublicPlatformInput, account_id: string, public_platform = false): Promise<any> {
    if (public_platform) {
      const { data: platform } = await this.app.api.post(`/accounts/${account_id}/platforms/public`, dto);
      return platform;
    } else {
      const { data: platform } = await this.app.api.post(`/accounts/${account_id}/platforms`, dto);
      return platform;
    }
  }
}
