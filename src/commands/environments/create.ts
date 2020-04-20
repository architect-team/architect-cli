import { flags } from '@oclif/command';
import { cli } from 'cli-ux';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import untildify from 'untildify';
import Command from '../../base-command';
import { EcsPlatformUtils } from '../../common/utils/ecs-platform.utils';
import { KubernetesPlatformUtils } from '../../common/utils/kubernetes-platform.utils';
import { PublicPlatformUtils } from '../../common/utils/public-platform.utils';
import { EnvironmentNameValidator } from '../../common/utils/validation';

interface CreateEnvironmentInput {
  name: string;
  namespace?: string;
  platform_id: string;
  config?: string;
}

export interface CreatePlatformInput {
  name: string;
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

export default class EnvironmentCreate extends Command {
  static aliases = ['environment:create', 'environments:create', 'envs:create', 'env:create'];
  static description = 'Register a new environment with Architect Cloud';
  private platforms: any[] = [];

  static args = [{
    name: 'name',
    description: 'Name to give the environment',
    parse: (value: string) => value.toLowerCase(),
  }];

  static flags = {
    ...Command.flags,
    namespace: flags.string({ char: 'n' }),
    type: flags.string({ char: 't', options: ['KUBERNETES', 'kubernetes', 'ARCHITECT_PUBLIC', 'architect_public', 'ECS', 'ecs'] }),
    host: flags.string({ char: 'h' }),
    kubeconfig: flags.string({ char: 'k', default: '~/.kube/config', exclusive: ['service_token', 'cluster_ca_cert', 'host'] }),
    // awsconfig: flags.string({ char: 'w', default: '~/.aws', exclusive: ['kubeconfig', 'service_token', 'cluster_ca_cert', 'host'] }), // TODO:106:CLI: replace the below lines with this one once we've configured aws cli to work.
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
    const environment = await this.create_environment();

    this.log(environment);
  }

  private async create_environment() {
    const { args, flags } = this.parse(EnvironmentCreate);

    this.platforms = await this.load_platforms();

    if (flags.namespace && !EnvironmentNameValidator.test(flags.namespace)) {
      throw new Error(`Namespace must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character`);
    }

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
        message: 'For which Architect account would you like to create this environment?',
        choices: this.accounts.rows.map((a: any) => { return { name: a.name, value: a }; }),
        default: selected_account,
      },
      {
        type: 'input',
        name: 'name',
        message: 'What would you like to name your new environment?',
        when: !args.name,
        filter: value => value.toLowerCase(),
        validate: value => {
          if (EnvironmentNameValidator.test(value)) return true;
          return `Name must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character`;
        },
        default: flags.namespace || '',
      },
      {
        when: async (answers: any) => {
          if (flags.platform) {
            return false;
          }
          this.platforms = await this.load_platforms(answers.account?.id || selected_account.id);
          if (!this.platforms || !this.platforms.length) {
            cli.log('The selected account has no configured platforms. Proceeding to create one now...');
            return false;
          }
          return true;
        },
        type: 'list',
        name: 'platform_id',
        message: 'On which Architect platform would you like to put this environment?',
        choices: async (answers: any) => {
          return [
            ...this.platforms
              .filter((p: any) => (p.account.id === answers.account?.id || p.account.id === selected_account.id))
              .map((p: any) => { return { name: `${p.name} (${p.type})`, value: p.id }; }),
            { name: 'Configure new platform', value: false },
          ];
        },
      },
    ]);

    if (selected_account) {
      answers.account = selected_account;
    }

    if (flags.platform) {
      const platform = await this.load_platform_by_name(answers.account.id, flags.platform);
      answers.platform_id = platform.id;
    }

    if (!answers.platform_id) {
      const platform = await this.create_platform(args, flags, answers.account);

      cli.action.start('Registering platform with Architect');
      const public_platform = Object.keys(platform).length === 1 && !!platform.name;
      const created_platform = await this.post_platform_to_api(platform, answers.account.id, public_platform);
      cli.action.stop();

      answers.platform_id = created_platform.id;
    }

    cli.action.start('Registering environment with Architect');
    const environment = await this.post_environment_to_api({
      name: args.name || answers.name,
      namespace: flags.namespace,
      platform_id: answers.platform_id,
      config: flags.config_file ? await fs.readJSON(untildify((flags.config_file))) : undefined,
    }, answers.account.id);
    cli.action.stop();

    return environment;
  }

  private async create_platform(args: any, flags: any, account: { id: string; name: string }) {
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
        return await KubernetesPlatformUtils.configure_kubernetes_platform(args, flags, account);
      case 'ECS':
        return await EcsPlatformUtils.configure_ecs_platform(args, flags, account);
      case 'ARCHITECT_PUBLIC':
        return await PublicPlatformUtils.runArchitectPublic(args, flags);
      default:
        throw new Error(`PlatformType=${selected_type} is not currently supported`);
    }
  }

  private async load_platforms(account_id?: string) {
    const endpoint = account_id ? `/platforms?account_id=${account_id}` : `/platforms`;
    const { data: { rows: platforms } } = await this.app.api.get(endpoint);
    return platforms;
  }

  private async load_platform_by_name(account_id: string, name: string) {
    const { data: platform } = await this.app.api.get(`/accounts/${account_id}/platforms/${name}`);
    if (!platform) {
      throw new Error(`No platform exists with name=${name}`);
    }
    return platform;
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

  private async post_environment_to_api(data: CreateEnvironmentInput, account_id: string): Promise<any> {
    const { data: environment } = await this.app.api.post(`/accounts/${account_id}/environments`, data);
    return environment;
  }
}
