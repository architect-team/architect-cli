import { flags } from '@oclif/command';
import { cli } from 'cli-ux';
import execa from 'execa';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import yaml from 'js-yaml';
import path from 'path';
import untildify from 'untildify';
import Command from '../../base-command';
import { EnvironmentNameValidator } from '../../common/utils/validation';

interface CreateEnvironmentInput {
  name: string;
  namespace?: string;
  platform_id: string;
  config?: string;
}

interface CreatePlatformInput {
  name: string;
  type: string;
  host: string;
  credentials: PlatformCredentials;
}

interface CreatePublicPlatformInput {
  name: string;
}

export type PlatformCredentials = KubernetesPlatformCredentials | EcsPlatformCredentials;

export interface KubernetesPlatformCredentials {
  kind: 'KUBERNETES';

  cluster_ca_cert: string;
  service_token: string;
}

export interface EcsPlatformCredentials {
  kind: 'ECS';
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
    type: flags.string({ char: 't', options: ['KUBERNETES', 'kubernetes', 'ARCHITECT_PUBLIC', 'architect_public'] }),
    host: flags.string({ char: 'h' }),
    kubeconfig: flags.string({ char: 'k', default: '~/.kube/config', exclusive: ['service_token', 'cluster_ca_cert', 'host'] }),
    service_token: flags.string({ description: 'Service token', env: 'ARCHITECT_SERVICE_TOKEN' }),
    cluster_ca_cert: flags.string({ description: 'File path of cluster_ca_cert', env: 'ARCHITECT_CLUSTER_CA_CERT' }),
    config_file: flags.string({ char: 'c' }),
    account: flags.string({ char: 'a' }),
    platform: flags.string({ char: 'p', exclusive: ['type', 'kubeconfig', 'service_token', 'cluster_ca_cert', 'host'] }),
  };

  private async createArchitectPlatform(dto: CreatePlatformInput | CreatePublicPlatformInput, account_id: string, public_platform = false): Promise<any> {
    try {
      if (public_platform) {
        const { data: platform } = await this.app.api.post(`/accounts/${account_id}/platforms/public`, dto);
        return platform;
      } else {
        const { data: platform } = await this.app.api.post(`/accounts/${account_id}/platforms`, dto);
        return platform;
      }
    } catch (err) {
      //TODO:89:we shouldn't have to do this on the client side
      if (err.response?.data?.statusCode === 403) {
        throw new Error(`You do not have permission to create a platform for the selected account.`);
      }
      if (err.response?.data?.status === 409) {
        throw new Error(`The server responded with 409 CONFLICT. Perhaps this platform name already exists under that account?`);
      }
      if (err.response?.data?.message) {
        throw new Error(err.response?.data?.message);
      }
      throw new Error(err);
    }
  }

  private async createArchitectEnvironment(data: CreateEnvironmentInput, account_id: string): Promise<any> {
    try {
      const { data: environment } = await this.app.api.post(`/accounts/${account_id}/environments`, data);
      return environment;
    } catch (err) {
      //TODO:89:we shouldn't have to do this on the client side
      if (err.response?.data?.statusCode === 403) {
        throw new Error(`You do not have permission to create an environment for the selected account.`);
      }
      if (err.response?.data?.status === 409) {
        throw new Error(`The server responded with 409 CONFLICT. Perhaps this environment name already exists under that account?`);
      }
      if (err.response?.data?.message?.message) {
        throw new Error(JSON.stringify(err.response?.data?.message?.message));
      }
      if (err.response?.data?.message) {
        throw new Error(err.response?.data?.message);
      }
      throw new Error(err);
    }
  }

  async load_platforms(account_id?: string) {
    const endpoint = account_id ? `/platforms?account_id=${account_id}` : `/platforms`;
    const { data: { rows: platforms } } = await this.app.api.get(endpoint);
    return platforms;
  }

  async load_platform_by_name(account_id: string, name: string) {
    const { data: platform } = await this.app.api.get(`/accounts/${account_id}/platforms/${name}`);
    if (!platform) {
      throw new Error(`No platform exists with name=${name}`);
    }
    return platform;
  }

  private async createKubernetesServiceAccount(kubeconfig_path: string, sa_name: string) {
    const set_kubeconfig = ['--kubeconfig', kubeconfig_path, '--namespace', 'default'];

    // Create the service account
    await execa('kubectl', [
      ...set_kubeconfig,
      'create', 'sa', sa_name,
    ]);

    // Bind the service account to the cluster-admin role
    await execa('kubectl', [
      ...set_kubeconfig,
      'create',
      'clusterrolebinding',
      `${sa_name}-cluster-admin`,
      '--clusterrole',
      'cluster-admin',
      '--serviceaccount',
      `default:${sa_name}`,
    ]);
  }

  private async runKubernetes() {
    const { args, flags } = this.parse(EnvironmentCreate);

    let kubeconfig: any;
    const kubeconfig_path = untildify(flags.kubeconfig!);
    try {
      kubeconfig = await fs.readFile(path.resolve(kubeconfig_path), 'utf-8');
    } catch {
      throw new Error(`No kubeconfig found at ${kubeconfig_path}`);
    }

    try {
      kubeconfig = yaml.safeLoad(kubeconfig);
    } catch {
      throw new Error('Invalid kubeconfig format. Did you provide the correct path?');
    }

    const set_kubeconfig = ['--kubeconfig', untildify(kubeconfig_path), '--namespace', 'default'];

    // Get original kubernetes current-context
    const { stdout: original_kubecontext } = await execa('kubectl', [
      ...set_kubeconfig,
      'config', 'current-context',
    ]);

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
        choices: [...this.platforms.map((p: any) => { return { name: `${p.name} (${p.type})`, value: p.id }; }), { name: 'Configure new platform', value: false }],
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
      answers.platform_id = await this.createPlatform(set_kubeconfig, kubeconfig_path, args, flags, kubeconfig, answers.account);
    }

    cli.action.start('Registering environment with Architect');

    const environment = await this.createArchitectEnvironment({
      name: args.name || answers.name,
      namespace: flags.namespace,
      platform_id: answers.platform_id,
      config: flags.config_file ? await fs.readJSON(untildify((flags.config_file))) : undefined,
    }, answers.account.id);

    await execa('kubectl', [
      ...set_kubeconfig,
      'config', 'set',
      'current-context', original_kubecontext,
    ]);
    cli.action.stop();

    return environment;
  }

  private async runArchitectPublic() {
    const { args, flags } = this.parse(EnvironmentCreate);

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
    ]);

    let platform_id;
    this.platforms = await this.load_platforms(answers.account?.id || selected_account.id);

    const public_platforms = this.platforms.filter(platform => platform.type === 'ARCHITECT_PUBLIC');
    if (public_platforms) {
      platform_id = public_platforms[0].id;
    }

    if (!platform_id) {
      const platform = await this.createArchitectPlatform({
        name: 'architect-public',
      }, answers.account.id, true);

      platform_id = platform.id;
    }

    cli.action.start('Registering environment with Architect');

    const environment = await this.createArchitectEnvironment({
      name: args.name || answers.name,
      namespace: flags.namespace,
      platform_id,
    }, answers.account.id);

    cli.action.stop();

    return environment;
  }

  private static default_platform_name(account: any, flags: any, answers: any) {
    const type = flags.type || answers.platform_type;
    return `${account.name}-${type}`.toLowerCase();
  }

  private async createPlatform(
    set_kubeconfig: any,
    kubeconfig_path: string,
    args: any,
    flags: any,
    kubeconfig: any,
    account: { id: string; name: string },
  ): Promise<string> {

    const new_platform_answers: any = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        when: !args.name,
        message: 'What would you like to name the new platform?',
        filter: value => value.toLowerCase(),
        validate: value => {
          if (EnvironmentNameValidator.test(value)) return true;
          return `Name must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character`;
        },
        default: (answers: any) => EnvironmentCreate.default_platform_name(account, flags, answers),
      },
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
      {
        type: 'input',
        name: 'service_account_name',
        message: 'What would you like to name the service account for your environment?',
        default: 'architect',
      },
      {
        when: async (answers: any) => {
          try {
            await execa('kubectl', [
              ...set_kubeconfig,
              'get', 'sa', answers.service_account_name,
              '-o', 'json',
            ]);
            return true;
          } catch {
            return false;
          }
        },
        type: 'confirm',
        name: 'use_existing_sa',
        message: 'A service account with that name already exists. Would you like to use it for this environment?',
      },
    ]);

    if (new_platform_answers.use_existing_sa === false) {
      throw new Error('Please select another service account name');
    }

    // Make sure the existing SA uses cluster-admin role binding
    if (new_platform_answers.use_existing_sa) {
      const { stdout } = await execa('kubectl', [
        ...set_kubeconfig,
        'get', 'clusterrolebinding',
        '-o', 'json',
      ]);
      const clusterrolebindings = JSON.parse(stdout);
      const sa_binding = clusterrolebindings.items.find(
        (rolebinding: any) =>
          rolebinding.subjects &&
          rolebinding.subjects.length > 0 &&
          rolebinding.subjects.find(
            (subject: any) =>
              subject.kind === 'ServiceAccount' &&
              subject.name === new_platform_answers.service_account_name
          )
      );

      if (!sa_binding) {
        await execa('kubectl', [
          ...set_kubeconfig,
          'create',
          'clusterrolebinding',
          `${new_platform_answers.service_account_name}-cluster-admin`,
          '--clusterrole',
          'cluster-admin',
          '--serviceaccount',
          `default:${new_platform_answers.service_account_name}`,
        ]);
      }
    }

    if (!new_platform_answers.use_existing_sa) {
      cli.action.start('Creating the service account');
      await this.createKubernetesServiceAccount(untildify(kubeconfig_path), new_platform_answers.service_account_name);
      cli.action.stop();
    }

    cli.action.start('Loading kubernetes configuration info');

    // Retrieve cluster host and ca certificate
    const cluster = kubeconfig.clusters.find((cluster: any) => cluster.name === new_platform_answers.context.context.cluster);
    let cluster_ca_cert: string;
    if ('certificate-authority-data' in cluster.cluster) {
      const ca_cert_buffer = Buffer.from(cluster.cluster['certificate-authority-data'], 'base64');
      cluster_ca_cert = ca_cert_buffer.toString('utf-8');
    } else {
      cluster_ca_cert = await fs.readFile(untildify(cluster.cluster['certificate-authority']), 'utf-8');
    }
    const cluster_host = cluster.cluster.server;

    // Retrieve service account token
    const saRes = await execa('kubectl', [
      ...set_kubeconfig,
      'get', 'sa', new_platform_answers.service_account_name,
      '-o', 'json',
    ]);
    const sa_secret_name = JSON.parse(saRes.stdout).secrets[0].name;
    const secret_res = await execa('kubectl', [
      ...set_kubeconfig,
      'get', 'secrets', sa_secret_name,
      '-o', 'json',
    ]);
    const sa_token_buffer = Buffer.from(JSON.parse(secret_res.stdout).data.token, 'base64');
    const service_token = sa_token_buffer.toString('utf-8');

    cli.action.stop();
    cli.action.start('Registering platform with Architect');

    const platform = await this.createArchitectPlatform({
      name: args.name || new_platform_answers.name,
      type: (flags.type || new_platform_answers.platform_type)?.toUpperCase(),
      host: cluster_host,
      credentials: {
        kind: (flags.type || new_platform_answers.platform_type)?.toUpperCase(),
        service_token,
        cluster_ca_cert,
      },
    }, account.id);

    cli.action.stop();

    return platform.id;
  }

  async run() {
    const { args, flags } = this.parse(EnvironmentCreate);

    this.platforms = await this.load_platforms();

    const new_platform_answers: any = await inquirer.prompt([
      {
        when: !flags.type,
        type: 'list',
        name: 'platform_type',
        message: 'On what type of platform would you like to create the environment?',
        choices: [
          'KUBERNETES',
          'ARCHITECT_PUBLIC',
        ],
      },
    ]);

    flags.type = new_platform_answers.platform_type;

    let environment;
    if (flags.type?.toUpperCase() === 'KUBERNETES' && flags.kubeconfig && !flags.host) {
      environment = await this.runKubernetes();
    } else if (flags.type?.toUpperCase() === 'ARCHITECT_PUBLIC') {
      environment = await this.runArchitectPublic();
    } else {
      throw new Error('We do not support that environment type at the moment.');
    }

    this.log(environment);
  }
}
